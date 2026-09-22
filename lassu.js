import { createClient } from '@supabase/supabase-js';
import QRCode from 'qrcode';
import { Html5Qrcode } from 'html5-qrcode';
import { createIcons, icons } from 'lucide';
import { registerSW } from 'virtual:pwa-register';

// Register Service Worker for offline application shell caching
if ('serviceWorker' in navigator) {
    try {
        const updateSW = registerSW({
            onNeedRefresh() {
                console.log('🔄 New application version ready.');
                updateSW(true);
            },
            onOfflineReady() {
                console.log('⚡ Lassu application shell cached for offline access.');
            },
        });
    } catch (e) {
        console.warn('PWA service worker registration skipped:', e);
    }
}

// Provide global createIcons for all dynamic render calls
window.lucide = {
    createIcons: () => createIcons({ icons })
};

function escapeMarkdown(text) {
    if (!text) return '';
    return text.toString().replace(/[_*[\]()~`>#+\-=|{}.!\\]/g, '\\$&');
}

function escapeHtml(text) {
    if (!text) return '';
    return text.toString()
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

const API_KEYS = [
    import.meta.env.VITE_YOUTUBE_API_KEY,
    import.meta.env.VITE_YOUTUBE_API_KEY_2,
    import.meta.env.VITE_YOUTUBE_API_KEY_3,
    import.meta.env.VITE_YOUTUBE_API_KEY_4
].filter(k => k && k.startsWith('AIza')); // Only use real Google API keys

let currentKeyIndex = 0;
const exhaustedKeys = new Set();

function hasApiKey() {
    return API_KEYS.length > 0;
}

function getApiKey() {
    if (API_KEYS.length === 0) return null;
    
    // Check if we have any healthy keys left
    const healthyKeys = API_KEYS.filter(k => !exhaustedKeys.has(k));
    if (healthyKeys.length === 0) return API_KEYS[0]; // Fallback to first if all dead (for error reporting)
    
    const key = API_KEYS[currentKeyIndex];
    currentKeyIndex = (currentKeyIndex + 1) % API_KEYS.length;

    // If current key is exhausted, skip to next
    if (exhaustedKeys.has(key)) return getApiKey();
    
    return key;
}

function markKeyAsExhausted(key) {
    if (key) {
        exhaustedKeys.add(key);
        console.warn(`Key ${key.slice(0,8)}... marked as exhausted.`);
    }
}

async function safeFetch(endpoint, retryCount = 0) {
    const key = getApiKey();
    if (!key) throw new Error('no_api_key');
    
    const url = `${endpoint}${endpoint.includes('?') ? '&' : '?'}key=${key}`;
    
    // Add timeout to prevent hanging requests
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000); // 8 second timeout

    try {
        const res = await fetch(url, { signal: controller.signal });
        clearTimeout(timeoutId);
        
        const data = await res.json();
        
        if (data.error) {
            const isQuotaError = data.error.message.includes('quota') || 
                               data.error.errors?.some(e => e.reason === 'quotaExceeded' || e.reason === 'rateLimitExceeded');
            
            if (isQuotaError) {
                markKeyAsExhausted(key);
                if (retryCount < API_KEYS.length) {
                    return safeFetch(endpoint, retryCount + 1);
                }
            }
            
            if (res.status === 403 && !isQuotaError) {
                const err = new Error('Access Restricted');
                err.status = 403;
                throw err;
            }

            throw new Error(data.error.message);
        }
        return data;
    } catch (err) {
        clearTimeout(timeoutId);
        if (err.name === 'AbortError') {
            console.warn('Request timed out, retrying...');
            if (retryCount < API_KEYS.length) return safeFetch(endpoint, retryCount + 1);
        }
        if (err.message.includes('quota') && retryCount < API_KEYS.length) {
            return safeFetch(endpoint, retryCount + 1);
        }
        throw err;
    }
}
const BASE_URL = 'https://www.googleapis.com/youtube/v3';
const TELEGRAM_INTERVAL = 3600000; // 1 Hour
let lastTelegramSent = parseInt(localStorage.getItem('last_tg_sent')) || Date.now();

// --- Supabase Config ---
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

function initSupabase() {
    if (supabaseUrl && supabaseKey && typeof supabaseUrl === 'string' && supabaseUrl.startsWith('http')) {
        try {
            return createClient(supabaseUrl, supabaseKey);
        } catch (err) {
            console.warn('[AI Studio] Supabase client initialization failed, falling back to local storage:', err);
        }
    }
    // Safe mock proxy when credentials are not supplied
    const queryStub = {
        select: () => queryStub,
        eq: () => queryStub,
        maybeSingle: async () => ({ data: null, error: null }),
        upsert: async () => ({ data: null, error: null })
    };
    return {
        from: () => queryStub
    };
}
const supabase = initSupabase();

// --- State Management ---
// --- State Management ---
const defaultChannels = [
    {
        id: 'UCq-Fj5jknLsUfVWSy4ixfCw',
        handle: '@MrBeast',
        name: 'MrBeast',
        avatar: 'https://yt3.googleusercontent.com/fxGky3Nc_D9qgnpSiaJTM9S-6S_K_8v9rJtp6F6N8-43d8v_071e_0989-1-P_899-7-P_8-P_8',
        subscribers: 300000000,
        views: 52000000000,
        lastSubCount: 299999900,
        status: 'up',
        uploadsId: 'UUq-Fj5jknLsUfVWSy4ixfCw',
        latestVideo: {
            title: "Loading...",
            published: "",
            views: "0"
        }
    },
    {
        id: 'UC-lHJZR3Gquu24_Vpw05Tw',
        handle: '@PewDiePie',
        name: 'PewDiePie',
        avatar: 'https://yt3.googleusercontent.com/5o00S39t2_8S8S_S0_0_0_0_0_0_0_0_0_0_0_0',
        subscribers: 111000000,
        views: 29000000000,
        lastSubCount: 111000050,
        status: 'down',
        uploadsId: 'UU-lHJZR3Gquu24_Vpw05Tw',
        latestVideo: {
            title: "Loading...",
            published: "",
            views: "0"
        }
    }
];

let channels = []; // Start empty
const UPDATE_INTERVAL = 3000; 
const API_SYNC_INTERVAL = 15 * 60 * 1000; // Strictly 15 minutes to save YouTube quota
let isInteracting = false;
let isFirstLoad = true;

// --- DOM Elements ---
const channelList = document.getElementById('channel-list');
const addModal = document.getElementById('add-modal');
const addBtn = document.getElementById('add-channel-btn');
const closeModal = document.querySelector('.close-modal');
const addForm = document.getElementById('add-channel-form');
const searchInput = document.getElementById('channel-search');
const sortSelect = document.getElementById('sort-select');
const toast = document.getElementById('toast');
const refreshBtn = document.getElementById('refresh-btn');
const cloudSyncBtn = document.getElementById('cloud-sync-btn');
const homeBtn = document.getElementById('home-btn');
const lastUpdateDiv = document.getElementById('last-updated');
const settingsBtn = document.getElementById('settings-btn');
const settingsModal = document.getElementById('settings-modal');
const closeSettings = document.querySelector('.close-settings');
const telegramForm = document.getElementById('telegram-form');
const testTgBtn = document.getElementById('test-tg');
const apiStatusBanner = document.getElementById('api-status-banner');
const apiBannerDesc = document.getElementById('api-banner-desc');
const bannerActionBtn = document.getElementById('banner-action-btn');

// --- Sync on Start & QR Share State ---
const syncOnStartToggle = document.getElementById('sync-on-start-toggle');
const btnOpenQrFromSettings = document.getElementById('btn-open-qr-from-settings');
const btnPullCloudNow = document.getElementById('btn-pull-cloud-now');
const qrSyncBtn = document.getElementById('qr-sync-btn');
const qrModal = document.getElementById('qr-modal');
const closeQrModal = document.getElementById('close-qr-modal');
const qrCodeCanvas = document.getElementById('qr-code-canvas');
const qrSecretCodeDisplay = document.getElementById('qr-secret-code-display');
const qrWordDisplay = document.getElementById('qr-word-display');
const qrChannelCountDisplay = document.getElementById('qr-channel-count-display');
const btnCopySyncLink = document.getElementById('btn-copy-sync-link');
const btnDoneQr = document.getElementById('btn-done-qr');

// Default sync on start is true (saved in localStorage)
let syncOnStartEnabled = localStorage.getItem('sync_on_start') !== 'false';

// --- Secret Code, Security Word & Account State ---
const securityBtn = document.getElementById('security-btn');
const secretGateModal = document.getElementById('secret-gate-modal');
const secretGateForm = document.getElementById('secret-gate-form');
const gateTitle = document.getElementById('gate-title');
const gateSubtitle = document.getElementById('gate-subtitle');
const gateInputLabel = document.getElementById('gate-input-label');
const gateCodeInput = document.getElementById('gate-code-input');
const gateWordInput = document.getElementById('gate-word-input');
const gateWordHint = document.getElementById('gate-word-hint');
const gateConfirmCodeGroup = document.getElementById('gate-confirm-code-group');
const gateCodeConfirmInput = document.getElementById('gate-code-confirm-input');
const tabLogin = document.getElementById('tab-login');
const tabCreate = document.getElementById('tab-create');
const btnToggleGateCode = document.getElementById('btn-toggle-gate-code');
const btnOpenScannerFromGate = document.getElementById('btn-open-scanner-from-gate');
const gateErrorMsg = document.getElementById('gate-error-msg');
const gateSubmitBtn = document.getElementById('gate-submit-btn');

// --- QR Scanner Elements ---
const qrScanBtn = document.getElementById('qr-scan-btn');
const qrScannerModal = document.getElementById('qr-scanner-modal');
const closeQrScanner = document.getElementById('close-qr-scanner');
const scannerFeedback = document.getElementById('scanner-feedback');
const qrFileInput = document.getElementById('qr-file-input');
const btnToggleCamera = document.getElementById('btn-toggle-camera');

let html5QrScanner = null;
let currentCameraFacing = 'environment'; // 'environment' (back) or 'user' (front)
let currentAccountMode = 'login'; // 'login' or 'create'

const changeCodeModal = document.getElementById('change-code-modal');
const changeCodeForm = document.getElementById('change-code-form');
const closeChangeCode = document.querySelector('.close-change-code');
const currSecretCodeInput = document.getElementById('curr-secret-code');
const newSecretCodeInput = document.getElementById('new-secret-code');
const confirmNewSecretCodeInput = document.getElementById('confirm-new-secret-code');
const sessionExpiryDateSpan = document.getElementById('session-expiry-date');
const btnLockNow = document.getElementById('btn-lock-now');
const channelSecretCodeInput = document.getElementById('channel-secret-code');

const FIFTEEN_DAYS_MS = 15 * 24 * 60 * 60 * 1000;
let cloudSecretCode = null; // Synchronized from Supabase

function getStoredSecretCode() {
    return localStorage.getItem('user_secret_code') || cloudSecretCode;
}

function getStoredSecurityWord() {
    return (localStorage.getItem('user_security_word') || '').toLowerCase().trim();
}

function getStoredLastActivity() {
    return parseInt(localStorage.getItem('user_last_active_time') || '0', 10);
}

function updateLastActivity() {
    localStorage.setItem('user_last_active_time', Date.now().toString());
}

function clearUserSessionAndData() {
    localStorage.removeItem('user_secret_code');
    localStorage.removeItem('user_security_word');
    localStorage.removeItem('user_last_active_time');
}

// --- Accounts Registry in Supabase (Slot 7) & Local Fallback ---
async function getCloudAccountsRegistry() {
    try {
        const { data: numData } = await supabase.from('channels').select('data').eq('id', 7).maybeSingle();
        if (numData?.data && Array.isArray(numData.data)) {
            return numData.data;
        }
        const { data: strData } = await supabase.from('channels').select('data').eq('id', 'user_accounts').maybeSingle();
        if (strData?.data && Array.isArray(strData.data)) {
            return strData.data;
        }
    } catch (e) {
        console.warn('Could not load accounts registry from cloud:', e);
    }
    try {
        const local = JSON.parse(localStorage.getItem('yt_tracker_accounts') || '[]');
        if (Array.isArray(local)) return local;
    } catch (e) {}
    return [];
}

async function saveCloudAccountsRegistry(accounts) {
    try {
        localStorage.setItem('yt_tracker_accounts', JSON.stringify(accounts));
        await supabase.from('channels').upsert({ id: 7, data: accounts });
    } catch (e) {
        console.warn('Numeric id 7 upsert failed, trying string id:', e);
        try {
            await supabase.from('channels').upsert({ id: 'user_accounts', data: accounts });
        } catch (err2) {
            console.error('Accounts registry cloud save failed:', err2);
        }
    }
}

async function isSecretCodeTaken(code) {
    const accounts = await getCloudAccountsRegistry();
    const exists = accounts.some(acc => acc.code === code);
    if (exists) return true;

    // Also check slot 6 (legacy secret code)
    try {
        const { data: secretData } = await supabase.from('channels').select('data').eq('id', 6).maybeSingle();
        if (secretData?.data && secretData.data.toString().trim() === code) {
            return true;
        }
    } catch (e) {}
    return false;
}

function checkSessionValidity() {
    const localCode = localStorage.getItem('user_secret_code');
    const lastActive = getStoredLastActivity();
    const now = Date.now();

    // If local code is set and valid within 15 days
    if (localCode) {
        if (lastActive > 0 && (now - lastActive) > FIFTEEN_DAYS_MS) {
            clearUserSessionAndData();
            return { valid: false, reason: 'expired_15_days' };
        }
        updateLastActivity();
        return { valid: true };
    }

    // If no local code on this device:
    // If cloud already has a secret code set, ask user to enter it to unlock device!
    if (cloudSecretCode) {
        return { valid: false, reason: 'enter_code' };
    }

    // Truly brand new user (neither local nor cloud code exists)
    return { valid: false, reason: 'first_time' };
}

function switchAccountGateTab(mode) {
    currentAccountMode = mode;
    if (gateErrorMsg) {
        gateErrorMsg.style.display = 'none';
        gateErrorMsg.textContent = '';
    }

    if (mode === 'create') {
        tabCreate?.classList.add('active');
        tabCreate?.setAttribute('aria-selected', 'true');
        tabLogin?.classList.remove('active');
        tabLogin?.setAttribute('aria-selected', 'false');

        if (gateTitle) gateTitle.textContent = 'Create New Account';
        if (gateSubtitle) gateSubtitle.textContent = 'Choose a unique 6-digit Secret Code and a Security Word (4 to 10 letters/numbers).';
        if (gateInputLabel) gateInputLabel.innerHTML = '<span>Choose 6-Digit Code <span style="color: var(--accent);">*</span></span> <span style="font-size: 0.72rem; color: var(--text-secondary);">(0-9 only)</span>';
        if (gateConfirmCodeGroup) gateConfirmCodeGroup.style.display = 'block';
        if (gateCodeConfirmInput) gateCodeConfirmInput.required = true;
        if (gateSubmitBtn) gateSubmitBtn.textContent = 'Check & Create Account';
        if (gateWordHint) gateWordHint.textContent = 'Choose a 4 to 10 character secret security word (letters and numbers only).';
    } else {
        tabLogin?.classList.add('active');
        tabLogin?.setAttribute('aria-selected', 'true');
        tabCreate?.classList.remove('active');
        tabCreate?.setAttribute('aria-selected', 'false');

        if (gateTitle) gateTitle.textContent = 'Account Login';
        if (gateSubtitle) gateSubtitle.textContent = 'Enter your 6-digit Secret Code and Security Word to log in.';
        if (gateInputLabel) gateInputLabel.innerHTML = '<span>6-Digit Secret Code <span style="color: var(--accent);">*</span></span> <span style="font-size: 0.72rem; color: var(--text-secondary);">(0-9 only)</span>';
        if (gateConfirmCodeGroup) gateConfirmCodeGroup.style.display = 'none';
        if (gateCodeConfirmInput) gateCodeConfirmInput.required = false;
        if (gateSubmitBtn) gateSubmitBtn.textContent = 'Login to Account';
        if (gateWordHint) gateWordHint.textContent = 'Required along with your Secret Code to securely log in.';
    }

    if (window.lucide && window.lucide.createIcons) window.lucide.createIcons();
}

function showSecretGateModal(mode) {
    if (!secretGateModal) return;
    if (gateErrorMsg) {
        gateErrorMsg.style.display = 'none';
        gateErrorMsg.textContent = '';
    }
    if (gateCodeInput) gateCodeInput.value = '';
    if (gateWordInput) gateWordInput.value = '';
    if (gateCodeConfirmInput) gateCodeConfirmInput.value = '';

    if (mode === 'first_time' || mode === 'create') {
        switchAccountGateTab('create');
    } else {
        switchAccountGateTab('login');
        if (mode === 'expired_15_days' && gateSubtitle) {
            gateSubtitle.textContent = 'Session expired after 15 days. Please login with your Secret Code and Security Word.';
        }
    }

    secretGateModal.classList.add('active');
    if (window.lucide && window.lucide.createIcons) window.lucide.createIcons();
    setTimeout(() => gateCodeInput?.focus(), 100);
}

function closeSecretGateModal() {
    if (secretGateModal) {
        secretGateModal.classList.remove('active');
    }
}

function updateSessionExpiryDisplay() {
    if (!sessionExpiryDateSpan) return;
    const lastActive = getStoredLastActivity() || Date.now();
    const expiry = new Date(lastActive + FIFTEEN_DAYS_MS);
    sessionExpiryDateSpan.textContent = expiry.toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
}

function updateApiStatusBanner() {
    if (!apiStatusBanner) return;
    
    if (API_KEYS.length === 0) {
        apiStatusBanner.style.display = 'flex';
        apiStatusBanner.classList.remove('error');
        if (apiBannerDesc) {
            apiBannerDesc.innerHTML = 'YouTube Data API key is not configured. Displaying cached creator data. Set <code>VITE_YOUTUBE_API_KEY</code> in project settings to enable real-time YouTube sync.';
        }
    } else {
        const healthyCount = API_KEYS.filter(k => !exhaustedKeys.has(k)).length;
        if (healthyCount === 0) {
            apiStatusBanner.style.display = 'flex';
            apiStatusBanner.classList.add('error');
            if (apiBannerDesc) {
                apiBannerDesc.innerHTML = 'All configured YouTube API keys have reached their daily quota limit. Showing cached creator data until quota resets (midnight PT).';
            }
        } else {
            apiStatusBanner.style.display = 'none';
        }
    }
}

let tgConfig = JSON.parse(localStorage.getItem('tg_config')) || { token: '', chatId: '', interval: 60 };
let tgIntervalId = null;

let lastApiSyncTime = parseInt(localStorage.getItem('last_api_sync_time')) || 0;

// --- Initialization ---
async function init() {
    setupEventListeners();
    setupPWA();
    if (window.lucide && window.lucide.createIcons) {
        window.lucide.createIcons();
    }

    // Check if user came from a QR code scan with auth code/key in URL (?auth=123456 or #code=123456)
    checkQrUrlParams();

    // Sync on Start: If enabled, automatically pulls channel data from Supabase
    if (syncOnStartEnabled) {
        console.log('⚡ [Sync on Start] Auto-pulling channel data from Supabase Cloud...');
        await fetchFromCloud();
    } else {
        console.log('ℹ️ [Sync on Start] Disabled by user setting. Using local channel cache.');
        // Load local channels cache if available
        const localRaw = localStorage.getItem('yt_tracker_channels');
        if (localRaw) {
            try {
                const parsed = JSON.parse(localRaw);
                if (Array.isArray(parsed) && parsed.length > 0) {
                    channels = parsed;
                }
            } catch(e) {}
        }
        // Still fetch cloud secret code silently so security lock knows cloud state
        try {
            const { data: secretData } = await supabase.from('channels').select('data').eq('id', 6).maybeSingle();
            if (secretData?.data) cloudSecretCode = secretData.data.toString();
        } catch(e) {}
    }

    // Now check session validity with full knowledge of cloud and local auth
    const sessionStatus = checkSessionValidity();
    if (!sessionStatus.valid) {
        showSecretGateModal(sessionStatus.reason);
    }

    renderChannels();
    updateApiStatusBanner();
    
    // Only sync if data is older than 15 minutes
    const now = Date.now();
    if (API_KEYS.length === 0) {
        if (lastUpdateDiv) {
            lastUpdateDiv.textContent = 'Showing cached creator data (YouTube API Key not configured)';
        }
    } else if (now - lastApiSyncTime > API_SYNC_INTERVAL) {
        console.log('Data stale, triggering YouTube sync...');
        syncAllChannels();
    } else {
        const nextSyncIn = Math.ceil((API_SYNC_INTERVAL - (now - lastApiSyncTime)) / 60000);
        console.log(`Using cached cloud data. Next sync in ${nextSyncIn}m`);
        if (lastUpdateDiv) {
            const lastTime = new Date(lastApiSyncTime).toLocaleTimeString();
            lastUpdateDiv.textContent = `Last API Sync: ${lastTime} (Cached)`;
        }
    }

    // Start UI simulation (for smooth counting)
    setInterval(updateStats, UPDATE_INTERVAL);
    
    // Start real API sync loop
    if (API_KEYS.length > 0) {
        setInterval(syncAllChannels, API_SYNC_INTERVAL);
    }
}

function setupEventListeners() {
    addBtn.addEventListener('click', () => {
        const storedCode = getStoredSecretCode();
        if (storedCode && channelSecretCodeInput) {
            channelSecretCodeInput.value = storedCode;
        }
        addModal.classList.add('active');
    });
    closeModal.addEventListener('click', () => addModal.classList.remove('active'));
    
    // Close modal on outside click
    window.addEventListener('click', (e) => {
        if (e.target === addModal) addModal.classList.remove('active');
    });

    addForm.addEventListener('submit', handleAddChannel);
    searchInput.addEventListener('input', renderChannels);
    sortSelect.addEventListener('change', renderChannels);

    refreshBtn.addEventListener('click', () => {
        if (API_KEYS.length === 0) {
            showToast('⚠️ No YouTube API Key configured. Please add one in project settings.');
            settingsBtn.click();
            return;
        }
        showToast('🔄 Fetching fresh data from YouTube & updating database...');
        syncAllChannels();
        refreshBtn.querySelector('i').classList.add('rotating');
        setTimeout(() => refreshBtn.querySelector('i').classList.remove('rotating'), 1000);
    });

    if (cloudSyncBtn) {
        cloudSyncBtn.addEventListener('click', async () => {
            const icon = cloudSyncBtn.querySelector('i');
            if (icon) icon.classList.add('rotating');
            showToast('☁️ Uploading channel list to database...');
            try {
                await saveData();
                updateLastActivity();
                showToast(`✅ Successfully uploaded ${channels.length} channel(s) to database!`);
            } catch (err) {
                console.error('Manual cloud upload error:', err);
                showToast('❌ Failed to upload channels to database.');
            } finally {
                setTimeout(() => {
                    if (icon) icon.classList.remove('rotating');
                }, 800);
            }
        });
    }

    if (bannerActionBtn) {
        bannerActionBtn.addEventListener('click', () => {
            settingsBtn.click();
        });
    }

    homeBtn.addEventListener('click', () => {
        searchInput.value = '';
        sortSelect.value = 'subs-desc';
        renderChannels();
        window.scrollTo({ top: 0, behavior: 'smooth' });
    });

    settingsBtn.addEventListener('click', () => {
        const tokenInput = document.getElementById('tg-token');
        const chatIdInput = document.getElementById('tg-chatid');
        const intervalSelect = document.getElementById('tg-interval');

        tokenInput.value = tgConfig.token || '';
        chatIdInput.value = tgConfig.chatId || '';
        
        const validIntervals = ['5', '15', '30', '60'];
        const currentInterval = (tgConfig.interval || 60).toString();
        intervalSelect.value = validIntervals.includes(currentInterval) ? currentInterval : '60';
        
        // Sync on Start UI checkbox state
        if (syncOnStartToggle) {
            syncOnStartToggle.checked = syncOnStartEnabled;
        }

        // Update Quota Monitor
        updateQuotaMonitorUI();
        
        settingsModal.classList.add('active');
    });

    // --- Sync on Start Toggle Change ---
    if (syncOnStartToggle) {
        syncOnStartToggle.addEventListener('change', (e) => {
            syncOnStartEnabled = e.target.checked;
            localStorage.setItem('sync_on_start', syncOnStartEnabled ? 'true' : 'false');
            showToast(syncOnStartEnabled ? '⚡ Sync on Start enabled' : 'ℹ️ Sync on Start disabled (uses local cache)');
        });
    }

    // --- Pull Cloud Now Button in Settings ---
    if (btnPullCloudNow) {
        btnPullCloudNow.addEventListener('click', async () => {
            showToast('☁️ Pulling channels & settings from database...');
            await fetchFromCloud();
            renderChannels();
            showToast(`✅ Cloud sync complete! (${channels.length} channels)`);
        });
    }

    // --- QR Sync Buttons & Modal Handlers ---
    if (qrSyncBtn) {
        qrSyncBtn.addEventListener('click', () => {
            openQrSessionModal();
        });
    }

    if (btnOpenQrFromSettings) {
        btnOpenQrFromSettings.addEventListener('click', () => {
            settingsModal.classList.remove('active');
            openQrSessionModal();
        });
    }

    if (closeQrModal) {
        closeQrModal.addEventListener('click', () => {
            closeQrSessionModal();
        });
    }

    if (btnDoneQr) {
        btnDoneQr.addEventListener('click', () => {
            closeQrSessionModal();
        });
    }

    if (btnCopySyncLink) {
        btnCopySyncLink.addEventListener('click', () => {
            const syncLink = generateSyncUrl();
            if (navigator.clipboard && navigator.clipboard.writeText) {
                navigator.clipboard.writeText(syncLink).then(() => {
                    showToast('📋 Quick Connect link copied to clipboard!');
                }).catch(() => {
                    showToast('Sync link ready. Please scan QR Code.');
                });
            } else {
                showToast('Sync link generated. Scan QR Code.');
            }
        });
    }

    function updateQuotaMonitorUI() {
        const activeCount = document.getElementById('active-keys-count');
        const statusList = document.getElementById('keys-status-list');
        
        if (API_KEYS.length === 0) {
            if (activeCount) {
                activeCount.textContent = '0/0';
                activeCount.style.color = '#eab308';
            }
            if (statusList) {
                statusList.innerHTML = '<div style="font-size: 0.75rem; color: var(--text-secondary); line-height: 1.4;">No YouTube API keys found in project settings.<br>Add <code>VITE_YOUTUBE_API_KEY</code> to enable live sync.</div>';
            }
            return;
        }

        const healthyCount = API_KEYS.filter(k => !exhaustedKeys.has(k)).length;
        activeCount.textContent = `${healthyCount}/${API_KEYS.length}`;
        activeCount.style.color = healthyCount === 0 ? 'var(--danger)' : 'var(--success)';

        statusList.innerHTML = API_KEYS.map((key, index) => {
            const isDead = exhaustedKeys.has(key);
            return `
                <div style="display: flex; justify-content: space-between; align-items: center;">
                    <span style="color: var(--text-primary); font-family: monospace;">Key ${index + 1} (${key.slice(0,4)}...${key.slice(-4)})</span>
                    <span style="color: ${isDead ? "● Exhausted" : "● Healthy"}; font-size: 0.7rem;">
                        ${isDead ? "● Exhausted" : "● Healthy"}
                    </span>
                </div>
            `;
        }).join('');
    }

    closeSettings.addEventListener('click', () => settingsModal.classList.remove('active'));
    
    telegramForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        tgConfig = {
            token: document.getElementById('tg-token').value.trim(),
            chatId: document.getElementById('tg-chatid').value.trim(),
            interval: parseInt(document.getElementById('tg-interval').value)
        };
        localStorage.setItem('tg_config', JSON.stringify(tgConfig));
        
        // Push Config to Cloud
        await saveTelegramConfig(tgConfig);
        
        startTelegramBot();
        settingsModal.classList.remove('active');
        showToast('Telegram settings synced to Cloud');
    });

    testTgBtn.addEventListener('click', () => sendTelegramUpdate(true));

    // Close settings on outside click
    window.addEventListener('click', (e) => {
        if (e.target === settingsModal) settingsModal.classList.remove('active');
        if (e.target === changeCodeModal) changeCodeModal.classList.remove('active');
    });

    // --- Tab Switching: Login vs Create Account ---
    if (tabLogin) {
        tabLogin.addEventListener('click', () => switchAccountGateTab('login'));
    }
    if (tabCreate) {
        tabCreate.addEventListener('click', () => switchAccountGateTab('create'));
    }

    // --- Show / Hide Password Toggle ---
    if (btnToggleGateCode) {
        btnToggleGateCode.addEventListener('click', () => {
            const isPwd = gateCodeInput.type === 'password';
            gateCodeInput.type = isPwd ? 'text' : 'password';
            if (gateCodeConfirmInput) gateCodeConfirmInput.type = isPwd ? 'text' : 'password';
            btnToggleGateCode.innerHTML = isPwd
                ? '<i data-lucide="eye-off" style="width: 15px; height: 15px;"></i>'
                : '<i data-lucide="eye" style="width: 15px; height: 15px;"></i>';
            if (window.lucide && window.lucide.createIcons) window.lucide.createIcons();
        });
    }

    // --- QR Scanner Buttons & Listeners ---
    if (btnOpenScannerFromGate) {
        btnOpenScannerFromGate.addEventListener('click', () => {
            openQrScanner();
        });
    }

    if (qrScanBtn) {
        qrScanBtn.addEventListener('click', () => {
            openQrScanner();
        });
    }

    if (closeQrScanner) {
        closeQrScanner.addEventListener('click', () => {
            closeQrScannerModal();
        });
    }

    if (btnToggleCamera) {
        btnToggleCamera.addEventListener('click', async () => {
            currentCameraFacing = currentCameraFacing === 'environment' ? 'user' : 'environment';
            if (html5QrScanner) {
                try {
                    await html5QrScanner.stop();
                } catch (e) {}
                await startQrCamera();
            }
        });
    }

    if (qrFileInput) {
        qrFileInput.addEventListener('change', async (e) => {
            const file = e.target.files?.[0];
            if (!file) return;
            if (scannerFeedback) {
                scannerFeedback.textContent = 'Scanning image file...';
                scannerFeedback.style.color = 'var(--accent)';
            }
            try {
                if (!html5QrScanner) {
                    html5QrScanner = new Html5Qrcode("qr-reader");
                }
                const decodedText = await html5QrScanner.scanFile(file, true);
                await handleQrScanResult(decodedText);
            } catch (err) {
                console.error('File QR scan error:', err);
                if (scannerFeedback) {
                    scannerFeedback.textContent = '⚠️ Could not find a valid QR code in this image.';
                    scannerFeedback.style.color = '#ef4444';
                }
            } finally {
                qrFileInput.value = '';
            }
        });
    }

    // --- Secret Gate Form Handling (Create Account vs Login) ---
    if (secretGateForm) {
        secretGateForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const enteredCode = gateCodeInput.value.trim();
            const enteredWord = (gateWordInput ? gateWordInput.value : '').trim();
            const confirmCode = gateCodeConfirmInput ? gateCodeConfirmInput.value.trim() : '';

            // 1. Validate 6 numeric digits
            if (!/^[0-9]{6}$/.test(enteredCode)) {
                gateErrorMsg.textContent = 'Secret Code must be exactly 6 numeric digits (0-9).';
                gateErrorMsg.style.display = 'block';
                gateCodeInput.focus();
                return;
            }

            // 2. Validate Security Word: 4 to 10 characters (alphanumeric, no spaces)
            if (enteredWord.length < 4 || enteredWord.length > 10 || !/^[a-zA-Z0-9_-]+$/.test(enteredWord)) {
                gateErrorMsg.textContent = 'Security Word must be between 4 and 10 letters/numbers (no spaces).';
                gateErrorMsg.style.display = 'block';
                gateWordInput?.focus();
                return;
            }

            const cleanWord = enteredWord.toLowerCase();
            const originalBtnText = gateSubmitBtn.textContent;
            gateSubmitBtn.disabled = true;

            try {
                if (currentAccountMode === 'create') {
                    // Check confirm password
                    if (enteredCode !== confirmCode) {
                        gateErrorMsg.textContent = 'Secret Code and confirmation do not match.';
                        gateErrorMsg.style.display = 'block';
                        gateCodeConfirmInput?.focus();
                        gateSubmitBtn.disabled = false;
                        return;
                    }

                    gateSubmitBtn.textContent = 'Checking database...';
                    const codeTaken = await isSecretCodeTaken(enteredCode);
                    if (codeTaken) {
                        gateErrorMsg.textContent = '❌ This 6-Digit Secret Code is already taken in the database! Please choose another code.';
                        gateErrorMsg.style.display = 'block';
                        gateCodeInput.focus();
                        gateSubmitBtn.disabled = false;
                        gateSubmitBtn.textContent = originalBtnText;
                        return;
                    }

                    // Code is unique! Register new account in Supabase slot 7
                    gateSubmitBtn.textContent = 'Creating account...';
                    const accounts = await getCloudAccountsRegistry();
                    const newAccount = {
                        code: enteredCode,
                        word: cleanWord,
                        created_at: Date.now()
                    };
                    accounts.push(newAccount);
                    await saveCloudAccountsRegistry(accounts);
                    await saveCloudSecretCode(enteredCode);

                    // Set session
                    localStorage.setItem('user_secret_code', enteredCode);
                    localStorage.setItem('user_security_word', cleanWord);
                    updateLastActivity();
                    closeSecretGateModal();
                    showToast(`✅ Account created successfully! Code: [${enteredCode}]`);
                    renderChannels();
                } else {
                    // Login Mode
                    gateSubmitBtn.textContent = 'Verifying credentials...';
                    const accounts = await getCloudAccountsRegistry();
                    let matched = accounts.find(acc => acc.code === enteredCode && acc.word?.toLowerCase() === cleanWord);

                    // Check legacy account in slot 6 if user created it previously
                    if (!matched && cloudSecretCode && cloudSecretCode === enteredCode) {
                        // Bind this security word to their legacy account
                        matched = {
                            code: enteredCode,
                            word: cleanWord,
                            created_at: Date.now()
                        };
                        accounts.push(matched);
                        await saveCloudAccountsRegistry(accounts);
                    }

                    if (matched) {
                        localStorage.setItem('user_secret_code', enteredCode);
                        localStorage.setItem('user_security_word', cleanWord);
                        updateLastActivity();
                        closeSecretGateModal();
                        showToast('🔓 Login successful! Dashboard unlocked.');
                        renderChannels();
                    } else {
                        // User specifically asked: "agar nahi toh bole wrong input"
                        gateErrorMsg.textContent = '❌ Wrong input! No account found with this Secret Code & Security Word combination.';
                        gateErrorMsg.style.display = 'block';
                        gateCodeInput.focus();
                    }
                }
            } catch (err) {
                console.error('Account action error:', err);
                gateErrorMsg.textContent = 'Connection error: ' + (err.message || 'Please try again.');
                gateErrorMsg.style.display = 'block';
            } finally {
                gateSubmitBtn.disabled = false;
                gateSubmitBtn.textContent = originalBtnText;
            }
        });
    }

    // --- Security Settings Button (Open Change Secret Code modal) ---
    if (securityBtn) {
        securityBtn.addEventListener('click', () => {
            updateSessionExpiryDisplay();
            currSecretCodeInput.value = '';
            newSecretCodeInput.value = '';
            confirmNewSecretCodeInput.value = '';
            changeCodeModal.classList.add('active');
        });
    }

    if (closeChangeCode) {
        closeChangeCode.addEventListener('click', () => {
            changeCodeModal.classList.remove('active');
        });
    }

    // --- Change Code Form Submission ---
    if (changeCodeForm) {
        changeCodeForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const currCode = currSecretCodeInput.value.trim();
            const newCode = newSecretCodeInput.value.trim();
            const confirmCode = confirmNewSecretCodeInput.value.trim();

            const storedCode = getStoredSecretCode();
            if (storedCode && currCode !== storedCode) {
                showToast('❌ Current Secret Code is incorrect.');
                currSecretCodeInput.focus();
                return;
            }

            if (!/^[0-9]{6}$/.test(newCode)) {
                showToast('⚠️ New Secret Code must be exactly 6 numeric digits.');
                newSecretCodeInput.focus();
                return;
            }

            if (newCode !== confirmCode) {
                showToast('⚠️ New Secret Code and confirmation do not match.');
                confirmNewSecretCodeInput.focus();
                return;
            }

            localStorage.setItem('user_secret_code', newCode);
            saveCloudSecretCode(newCode);
            updateLastActivity();
            changeCodeModal.classList.remove('active');
            showToast('✅ Secret Code updated successfully!');
        });
    }

    // --- Lock Session Now Button ---
    if (btnLockNow) {
        btnLockNow.addEventListener('click', () => {
            clearUserSessionAndData();
            changeCodeModal.classList.remove('active');
            showSecretGateModal('lock_screen');
            showToast('Dashboard locked. Secret Code required to unlock.');
        });
    }
}

// --- PWA Installation & Offline State Management ---
let deferredPWAInstallPrompt = null;

function setupPWA() {
    const installBtn = document.getElementById('pwa-install-btn');
    const iosModal = document.getElementById('pwa-ios-modal');
    const closeIosBtn = document.getElementById('close-pwa-ios-modal');
    const doneIosBtn = document.getElementById('btn-done-ios-pwa');
    const offlineBanner = document.getElementById('offline-banner');

    // Detect standalone mode (already installed on homescreen)
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches ||
                         window.navigator.standalone === true;

    // Detect iOS devices
    const userAgent = window.navigator.userAgent.toLowerCase();
    const isIOS = /iphone|ipad|ipod/.test(userAgent);

    if (isStandalone) {
        if (installBtn) installBtn.style.display = 'none';
    } else if (isIOS) {
        // iOS Safari does not support beforeinstallprompt event, provide guided instructions
        if (installBtn) {
            installBtn.style.display = 'inline-flex';
            installBtn.onclick = () => {
                if (iosModal) {
                    iosModal.classList.add('active');
                    if (window.lucide && window.lucide.createIcons) window.lucide.createIcons();
                }
            };
        }
    }

    if (closeIosBtn) {
        closeIosBtn.onclick = () => {
            if (iosModal) iosModal.classList.remove('active');
        };
    }
    if (doneIosBtn) {
        doneIosBtn.onclick = () => {
            if (iosModal) iosModal.classList.remove('active');
        };
    }

    // Android, Chromium & Desktop PWA prompt capture
    window.addEventListener('beforeinstallprompt', (e) => {
        e.preventDefault();
        deferredPWAInstallPrompt = e;
        if (installBtn && !isStandalone) {
            installBtn.style.display = 'inline-flex';
            if (window.lucide && window.lucide.createIcons) window.lucide.createIcons();
        }
    });

    if (installBtn && !isIOS) {
        installBtn.onclick = async () => {
            if (!deferredPWAInstallPrompt) {
                showToast('💡 Tap your browser menu and choose "Add to Home screen" or "Install App".');
                return;
            }
            deferredPWAInstallPrompt.prompt();
            const { outcome } = await deferredPWAInstallPrompt.userChoice;
            if (outcome === 'accepted') {
                showToast('🎉 Lassu installed to your device!');
                installBtn.style.display = 'none';
                deferredPWAInstallPrompt = null;
            }
        };
    }

    window.addEventListener('appinstalled', () => {
        if (installBtn) installBtn.style.display = 'none';
        showToast('🎉 Lassu is now installed!');
    });

    // Offline & Online Connectivity Handlers
    function updateOnlineStatus() {
        if (!offlineBanner) return;
        if (navigator.onLine) {
            offlineBanner.style.display = 'none';
        } else {
            offlineBanner.style.display = 'flex';
        }
    }

    window.addEventListener('offline', () => {
        updateOnlineStatus();
        showToast('📡 Offline Mode: Application shell is cached and accessible.', 4000);
    });

    window.addEventListener('online', () => {
        updateOnlineStatus();
        showToast('🟢 Back Online: Cloud sync restored.', 3000);
    });

    updateOnlineStatus();
}

function startTelegramBot() {
    if (tgIntervalId) {
        clearInterval(tgIntervalId);
        tgIntervalId = null;
    }
    if (!tgConfig.token || !tgConfig.chatId) return;

    console.log(`Telegram Bot configured. Sync schedule aligned every ${tgConfig.interval} mins.`);
    updateSettingsTimer();
}

async function sendTelegramUpdate(isTest = false) {
    if (!tgConfig.token || !tgConfig.chatId) {
        if (isTest) showToast('Please set Telegram Token & Chat ID first');
        return;
    }

    // Ensure newest data from YouTube is fetched & saved to database right before Telegram report
    if (channels.length > 0 && API_KEYS.length > 0) {
        try {
            console.log('Fetching freshest stats from YouTube for Telegram update...');
            await syncAllChannels(true);
        } catch (syncErr) {
            console.warn('Pre-telegram sync notice:', syncErr.message);
        }
    }

    // 1. Sort by today's growth (Top Gainers)
    const topGainers = [...channels]
        .sort((a, b) => b.difference - a.difference)
        .slice(0, 5)
        .filter(ch => ch.difference > 0);

    // 2. Sort by total subscribers (Overall Rank)
    const sorted = [...channels].sort((a, b) => b.subscribers - a.subscribers);
    const top3 = sorted.slice(0, 3);

    if (topGainers.length === 0 && top3.length === 0 && !isTest) return; 

    let message = `📊 *Lassu Tracker ${isTest ? '(TEST)' : 'Report'}*\n`;
    message += `⏰ ${new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}\n\n`;
    
    if (topGainers.length > 0) {
        message += `🔥 *Top Gainers Today:* \n`;
        topGainers.forEach((ch, idx) => {
            const cleanName = escapeMarkdown(ch.name);
            message += `${idx + 1}. *${cleanName}*: +${ch.difference} subs\n`;
        });
        message += `\n`;
    }

    if (top3.length > 0) {
        message += `🏆 *Top 3 Creators:* \n`;
        top3.forEach((ch, i) => {
            const cleanName = escapeMarkdown(ch.name);
            const diffStr = ch.difference !== 0 ? ` (${ch.difference > 0 ? '+' : ''}${ch.difference})` : '';
            message += `${i + 1}. ${cleanName}: ${ch.subscribers.toLocaleString()}${diffStr}\n`;
        });
    }

    message += `\n📱 Total tracked: ${channels.length}`;
    
    // Quota Monitor
    const healthyKeys = API_KEYS.filter(k => !exhaustedKeys.has(k)).length;
    if (healthyKeys === 0) {
        message += `\n⚠️ *API Status:* Quota Exhausted`;
    }

    try {
        const url = `https://api.telegram.org/bot${tgConfig.token}/sendMessage`;
        const res = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                chat_id: tgConfig.chatId,
                text: message,
                parse_mode: 'Markdown'
            })
        });

        const data = await res.json();
        if (data.ok) {
            if (isTest) showToast('Test message sent!');
            // Auto-refresh stats when message is sent
            console.log('Telegram update sent, triggering auto-sync...');
            syncAllChannels();
        } else {
            throw new Error(data.description);
        }
    } catch (err) {
        console.error('Telegram Error:', err);
        if (isTest) showToast('Telegram Error: ' + err.message);
    }
}

// --- Logic ---

async function handleAddChannel(e) {
    e.preventDefault();
    const btn = e.submitter;
    const input = document.getElementById('channel-id');
    const resultsContainer = document.getElementById('search-results');
    const value = input.value.trim();

    if (!value) return;

    if (API_KEYS.length === 0) {
        showToast('⚠️ Please configure VITE_YOUTUBE_API_KEY in Settings to search & add channels.');
        resultsContainer.innerHTML = '<p style="text-align:center; font-size:0.8rem; color: var(--warning, #eab308);">YouTube Data API key is required to search and add channels. Please add it in project settings.</p>';
        return;
    }
    
    btn.disabled = true;
    btn.textContent = 'Searching...';
    resultsContainer.innerHTML = '<div class="loading-spinner"></div>';

    try {
        const searchResults = await searchYoutube(value);
        if (!searchResults || searchResults.length === 0) {
            resultsContainer.innerHTML = '<p style="text-align:center; font-size:0.8rem;">No channels found.</p>';
            return;
        }

        renderSearchResults(searchResults);
    } catch (err) {
        showToast(err.message || 'Error searching channels');
        resultsContainer.innerHTML = '';
    } finally {
        btn.disabled = false;
        btn.textContent = 'Search';
    }
}

async function searchYoutube(query) {
    let identifier = query.trim();

    // --- 1. Robust URL/Handle Extraction ---
    if (identifier.includes('youtube.com/') || identifier.includes('youtu.be/')) {
        try {
            const urlStr = identifier.startsWith('http') ? identifier : 'https://' + identifier;
            const url = new URL(urlStr);
            const path = url.pathname;
            
            if (path.includes('/channel/')) {
                identifier = path.split('/channel/')[1].split('/')[0];
            } else if (path.includes('/@')) {
                identifier = '@' + path.split('/@')[1].split('/')[0];
            } else {
                identifier = path.split('/').filter(p => p).pop();
            }
        } catch (e) {
            console.error('URL parse error', e);
        }
    }

    // --- 2. Try Direct Fetch (Saves Quota) ---
    const isDirectId = identifier.startsWith('UC') && identifier.length >= 20;
    const isHandle = identifier.startsWith('@');

    if (isDirectId || isHandle) {
        try {
            const param = isDirectId ? `id=${identifier}` : `forHandle=${identifier.replace('@', '')}`;
            const data = await safeFetch(`${BASE_URL}/channels?part=snippet,statistics,contentDetails&${param}`);
            if (data.items && data.items.length > 0) {
                const item = data.items[0];
                return [{
                    id: item.id,
                    name: item.snippet.title,
                    avatar: item.snippet.thumbnails.default.url,
                    handle: item.snippet.customUrl || item.snippet.title,
                    isDirect: true // Flag to show it's a direct match
                }];
            }
        } catch (e) {
            console.warn('Direct fetch failed, falling back to search');
        }
    }

    // --- 3. Fallback to Search (Uses more quota) ---
    const q = identifier.startsWith('@') ? `"${identifier}"` : identifier;
    const data = await safeFetch(`${BASE_URL}/search?part=snippet&q=${encodeURIComponent(q)}&type=channel&maxResults=5`);
    if (!data.items) return [];

    return data.items.map(item => ({
        id: item.id.channelId,
        name: item.snippet.channelTitle,
        avatar: item.snippet.thumbnails.default.url,
        handle: 'YouTube Channel',
        isDirect: false
    }));
}

function renderSearchResults(results) {
    const container = document.getElementById('search-results');
    container.innerHTML = results.map(res => {
        const safeName = escapeHtml(res.name || 'YouTube Channel');
        const safeHandle = escapeHtml(res.handle || '@channel');
        const safeAvatar = encodeURI(res.avatar || 'https://www.gstatic.com/youtube/media/ytp/yt-logo.png');
        const safeId = escapeHtml(res.id || '');
        return `
            <div class="search-result-item">
                <img src="${safeAvatar}" alt="${safeName}" width="40" height="40" loading="lazy" class="result-avatar" onerror="this.src='https://www.gstatic.com/youtube/media/ytp/yt-logo.png'">
                <div class="result-info">
                    <span class="result-name">${safeName}</span>
                    <span class="result-handle">${safeHandle}</span>
                </div>
                <button class="btn-add-result" data-id="${safeId}" data-name="${safeName}" aria-label="Track ${safeName}">Track</button>
            </div>
        `;
    }).join('');

    container.querySelectorAll('.btn-add-result').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const id = btn.getAttribute('data-id');
            const name = btn.getAttribute('data-name');
            confirmAddChannel(e, id, name);
        });
    });
}

async function confirmAddChannel(e, id, name) {
    const btn = e.target;
    if (btn.disabled) return;
    
    // Check if secret code is entered and correct
    const enteredCode = channelSecretCodeInput ? channelSecretCodeInput.value.trim() : '';
    const storedCode = getStoredSecretCode();

    if (!enteredCode || enteredCode.length !== 6) {
        showToast('🔒 Please enter your 6-digit Secret Code above');
        if (channelSecretCodeInput) {
            channelSecretCodeInput.focus();
            channelSecretCodeInput.style.borderColor = 'var(--danger)';
            setTimeout(() => { channelSecretCodeInput.style.borderColor = ''; }, 2500);
        }
        return;
    }

    if (storedCode && enteredCode !== storedCode) {
        showToast('❌ Incorrect Secret Code! Cannot add channel to database.');
        if (channelSecretCodeInput) {
            channelSecretCodeInput.value = '';
            channelSecretCodeInput.focus();
            channelSecretCodeInput.style.borderColor = 'var(--danger)';
            setTimeout(() => { channelSecretCodeInput.style.borderColor = ''; }, 2500);
        }
        return;
    }

    // Refresh 15-day activity
    updateLastActivity();

    btn.disabled = true;
    const originalText = btn.textContent;
    btn.textContent = 'Adding...';

    try {
        if (channels.some(c => c.id === id)) {
            showToast('Already tracking this channel');
            btn.disabled = false;
            btn.textContent = originalText;
            return;
        }

        const fullData = await getChannelDetails(id);
        if (fullData) {
            channels.push(fullData);
            await saveData();
            renderChannels();
            showToast(`Success! Now tracking ${name} (Saved to database)`);
            addModal.classList.remove('active');
            document.getElementById('search-results').innerHTML = '';
            document.getElementById('channel-id').value = '';
            if (channelSecretCodeInput) channelSecretCodeInput.value = '';
        } else {
            showToast('Could not fetch channel details. Quota might be low.');
        }
    } catch (err) {
        console.error('Add channel error:', err);
        const msg = err.message.includes('quota') ? 'API Quota Exceeded' : (err.message || 'Failed to add');
        showToast(`Error: ${msg}`);
    } finally {
        if (btn) {
            btn.disabled = false;
            btn.textContent = originalText;
        }
    }
}

async function getChannelDetails(channelId) {
    try {
        const channelData = await safeFetch(`${BASE_URL}/channels?part=statistics,snippet,contentDetails&id=${channelId}`);
        if (!channelData.items || channelData.items.length === 0) return null;
        
        const channel = channelData.items[0];
        const today = new Date().toISOString().split('T')[0];
        const isHidden = channel.statistics?.hiddenSubscriberCount;
        const subs = isHidden ? 0 : (parseInt(channel.statistics?.subscriberCount || '0', 10) || 0);
        const avatarUrl = channel.snippet?.thumbnails?.medium?.url || 
                          channel.snippet?.thumbnails?.default?.url || 
                          channel.snippet?.thumbnails?.high?.url || 
                          'https://www.gstatic.com/youtube/media/ytp/yt-logo.png';
        return {
            id: channelId,
            handle: channel.snippet?.customUrl || channel.snippet?.title || 'YouTube Creator',
            name: channel.snippet?.title || 'Unknown Channel',
            avatar: avatarUrl,
            subscribers: subs,
            lastSubCount: subs,
            startDaySubs: subs,
            lastResetDate: today,
            difference: 0,
            status: 'neutral'
        };
    } catch (err) {
        console.error('getChannelDetails failed:', err);
        throw err;
    }
}

async function syncAllChannels(silent = false) {
    if (channels.length === 0) return;
    
    const today = new Date().toISOString().split('T')[0];
    const ids = channels.map(c => c.id).filter(id => id && id.startsWith('UC')).join(',');
    
    if (!ids) return;

    try {
        const idArray = ids.split(',');
        let allChannelStats = [];
        let videoStatsMap = new Map();

        // --- STEP 1: Channels Batch (Subscribers) ---
        for (let i = 0; i < idArray.length; i += 50) {
            const chunk = idArray.slice(i, i + 50).join(',');
            const data = await safeFetch(`${BASE_URL}/channels?part=statistics&id=${chunk}`);
            if (data.items) allChannelStats = allChannelStats.concat(data.items);
        }

        // --- STEP 3: Local Array Update ---
        channels = channels.map(ch => {
            const apiData = allChannelStats.find(item => item.id === ch.id);
            if (!apiData) return ch;

            const isHidden = apiData.statistics?.hiddenSubscriberCount;
            const newSubs = isHidden ? (ch.subscribers || 0) : (parseInt(apiData.statistics?.subscriberCount || '0', 10) || ch.subscribers || 0);
            let startDaySubs = ch.startDaySubs || newSubs;
            let lastResetDate = ch.lastResetDate || today;
            
            if (lastResetDate !== today) {
                startDaySubs = newSubs;
                lastResetDate = today;
            }

            return {
                ...ch,
                subscribers: newSubs,
                startDaySubs: startDaySubs,
                lastResetDate: lastResetDate,
                difference: newSubs - startDaySubs,
                status: newSubs > ch.lastSubCount ? 'up' : (newSubs < ch.lastSubCount ? 'down' : 'neutral'),
                lastSubCount: newSubs
            };
        });

        await saveData();
        renderChannels(false);
        if (!silent) {
            showToast('☁️ Channels & latest stats saved to database!');
        }
        
        lastApiSyncTime = Date.now();
        localStorage.setItem('last_api_sync_time', lastApiSyncTime.toString());
        await saveSyncTime(lastApiSyncTime);

        if (lastUpdateDiv) {
            lastUpdateDiv.textContent = `Last API Sync: ${new Date().toLocaleTimeString()} (Auto-syncs every 15 mins)`;
        }
    } catch (e) {
        console.warn('Batch Sync notice:', e.message);
        if (typeof updateApiStatusBanner === 'function') updateApiStatusBanner();
        if (e.message === 'no_api_key') {
            if (lastUpdateDiv) {
                lastUpdateDiv.textContent = 'Showing cached creator data (YouTube API Key not configured)';
            }
        } else if (e.message.includes('quota') || e.message.includes('403')) {
            const nextKey = getApiKey(); 
            if (nextKey) setTimeout(syncAllChannels, 2000);
            else {
                showToast('All YouTube API keys exhausted for today.');
                if (lastUpdateDiv) {
                    lastUpdateDiv.textContent = 'Daily YouTube API quota reached. Showing cached creator data.';
                }
            }
        } else {
            showToast('Sync notice: ' + e.message);
        }
    }
}

function updateStats() {
    // Only re-render if not interacting or modal is closed
    if (!isInteracting && !addModal.classList.contains('active')) {
        renderChannels(false);
    }
}

function renderChannels(isFull = true) {
    const searchTerm = searchInput.value.toLowerCase();
    const sortValue = sortSelect.value;

    let filtered = channels.filter(ch => 
        ch.name.toLowerCase().includes(searchTerm) || 
        ch.handle.toLowerCase().includes(searchTerm)
    );

    // Sorting
    filtered.sort((a, b) => {
        switch (sortValue) {
            case 'subs-asc': return a.subscribers - b.subscribers;
            case 'subs-desc': return b.subscribers - a.subscribers;
            case 'views-asc': return a.views - b.views;
            case 'views-desc': return b.views - a.views;
            default: return 0;
        }
    });

    // If it's a lightweight update and the list length is same, just update values
    if (!isFull && channelList.children.length === filtered.length && !channelList.querySelector('.empty-state')) {
        filtered.forEach(ch => {
            const card = channelList.querySelector(`.channel-card[data-id="${ch.id}"]`);
            if (card) {
                const subValue = card.querySelector('.stat-value');
                if (subValue) {
                    const diffHtml = ch.difference !== 0 ? `<span class="diff-tag ${ch.difference > 0 ? 'up' : 'down'}">${ch.difference > 0 ? '+' : ''}${ch.difference}</span>` : '';
                    subValue.innerHTML = `${(ch.subscribers || 0).toLocaleString()} ${diffHtml}`;
                }
            }
        });
        return;
    }

    if (filtered.length === 0) {
        channelList.innerHTML = isFirstLoad ? `
            <div class="empty-state">
                <div class="loading-spinner"></div>
                <p>Connecting to Cloud...</p>
            </div>
        ` : `
            <div class="empty-state">
                <i data-lucide="layout" class="empty-icon"></i>
                <p>No channels added yet. Start by adding your favorite creator!</p>
            </div>
        `;
        lucide.createIcons();
        return;
    }

    // Full render
    const html = filtered.map((ch, index) => {
        const safeName = escapeHtml(ch.name || 'YouTube Creator');
        const safeHandle = escapeHtml(ch.handle || '@channel');
        const safeAvatar = encodeURI(ch.avatar || 'https://www.gstatic.com/youtube/media/ytp/yt-logo.png');
        const safeSubs = (ch.subscribers || 0).toLocaleString();
        return `
        <div class="channel-card" data-id="${ch.id}">
            <div class="rank-badge">#${index + 1}</div>
            <div class="card-actions">
                <button class="btn-delete" title="Hold to delete" aria-label="Delete channel ${safeName}">
                    <i data-lucide="trash-2"></i>
                    <div class="delete-progress"></div>
                </button>
            </div>
            
            <div class="card-header">
                <img src="${safeAvatar}" alt="${safeName}" width="40" height="40" loading="lazy" class="channel-avatar" onerror="this.src='https://www.gstatic.com/youtube/media/ytp/yt-logo.png'">
                <div class="channel-info">
                    <h3>${safeName}</h3>
                    <p>${safeHandle}</p>
                </div>
            </div>

            <div class="stats-grid">
                <div class="stat-item">
                    <span class="stat-label">Subscribers</span>
                    <span class="stat-value">
                        ${safeSubs}
                        ${ch.difference !== 0 ? `<span class="diff-tag ${ch.difference > 0 ? 'up' : 'down'}">${ch.difference > 0 ? '+' : ''}${ch.difference}</span>` : ''}
                    </span>
                </div>
            </div>
        </div>
    `;
    }).join('');

    channelList.innerHTML = html;
    lucide.createIcons();
    attachDeleteHandlers();
}

function attachDeleteHandlers() {
    const deleteBtns = document.querySelectorAll('.btn-delete');
    
    deleteBtns.forEach(btn => {
        let holdTimer = null;
        let isTouching = false;
        const progress = btn.querySelector('.delete-progress');
        const card = btn.closest('.channel-card');
        const channelId = card ? card.dataset.id : null;
        if (!channelId) return;

        const startHold = (e) => {
            if (e.type === 'touchstart') {
                isTouching = true;
                isInteracting = true;
            } else if (e.type === 'mousedown' && isTouching) {
                return;
            }
            clearTimeout(holdTimer);
            progress.style.transition = 'width 1.5s linear';
            progress.style.width = '100%';
            
            holdTimer = setTimeout(() => {
                deleteChannel(channelId);
                isInteracting = false;
                isTouching = false;
            }, 1500);
        };

        const stopHold = () => {
            clearTimeout(holdTimer);
            progress.style.transition = 'none';
            progress.style.width = '0%';
            isInteracting = false;
            setTimeout(() => { isTouching = false; }, 400);
        };

        btn.onclick = (e) => {
            e.stopPropagation();
            if (progress.style.width !== '100%') {
                showToast("Press and hold to delete");
            }
        };

        btn.onmousedown = startHold;
        btn.onmouseup = stopHold;
        btn.onmouseleave = stopHold;
        
        btn.ontouchstart = (e) => {
            startHold(e);
        };
        btn.ontouchend = stopHold;
        btn.ontouchcancel = stopHold;
    });
}

async function deleteChannel(id) {
    const index = channels.findIndex(ch => ch.id === id);
    if (index !== -1) {
        const name = channels[index].name;
        channels.splice(index, 1);
        await saveData(); // Ensure it's saved before continuing
        renderChannels();
        showToast(`Removed tracking for ${name}`);
    }
}

function formatNumber(num) {
    if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
    if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
    return num;
}

async function fetchFromCloud() {
    // 1. Gather data from ALL possible Local Storage keys
    const keys = ['yt_tracker_channels', 'tracked_channels', 'yt_channels', 'channels'];
    let localData = [];
    keys.forEach(k => {
        const raw = localStorage.getItem(k);
        if (raw) {
            try {
                const parsed = JSON.parse(raw);
                if (Array.isArray(parsed)) localData = [...localData, ...parsed];
            } catch(e) {}
        }
    });

    try {
        // 2. Fetch from ALL possible Supabase slots for maximum compatibility
        const { data: newData } = await supabase.from('channels').select('data').eq('id', 1).maybeSingle();
        const { data: timerDataNum } = await supabase.from('channels').select('data').eq('id', 2).maybeSingle();
        const { data: configDataNum } = await supabase.from('channels').select('data').eq('id', 3).maybeSingle();
        const { data: syncTimeData } = await supabase.from('channels').select('data').eq('id', 4).maybeSingle();
        const { data: secretData } = await supabase.from('channels').select('data').eq('id', 6).maybeSingle();
        
        // --- Cloud Secret Code Sync ---
        if (secretData?.data) {
            cloudSecretCode = secretData.data.toString();
        }

        // --- Sync Time ---
        if (syncTimeData?.data) {
            lastApiSyncTime = parseInt(syncTimeData.data);
            localStorage.setItem('last_api_sync_time', lastApiSyncTime.toString());
        }
        
        // Fallbacks for legacy string IDs
        const { data: timerDataStr } = await supabase.from('channels').select('data').eq('id', 'timer_config').maybeSingle();
        const { data: configDataStr } = await supabase.from('channels').select('data').eq('id', 'tg_config').maybeSingle();
        const { data: oldData } = await supabase.from('channels').select('data').eq('id', 'global_list').maybeSingle();

        // --- Aggressive Config Sync (with legacy fallback) ---
        const finalConfig = configDataNum?.data || configDataStr?.data;
        if (finalConfig) {
            console.log('Cloud Config Found, syncing devices...');
            tgConfig = finalConfig;
            localStorage.setItem('tg_config', JSON.stringify(tgConfig));
            startTelegramBot();
            
            // Migrate to Numeric ID if needed
            if (!configDataNum?.data) await saveTelegramConfig(finalConfig);
        }

        // --- Aggressive Timer Sync (with legacy fallback) ---
        const finalTimer = timerDataNum?.data || timerDataStr?.data;
        if (finalTimer?.last_sent) {
            lastTelegramSent = parseInt(finalTimer.last_sent);
            localStorage.setItem('last_tg_sent', lastTelegramSent.toString());
            updateSettingsTimer();
            
            // Migrate to Numeric ID if needed
            if (!timerDataNum?.data) await saveMasterTimer(lastTelegramSent);
        }

        // 3. FORCE MERGE everything for Channels
        let allSourceData = [...localData];
        if (newData?.data) allSourceData = [...allSourceData, ...newData.data];
        if (oldData?.data) allSourceData = [...allSourceData, ...oldData.data];

        // 4. Remove duplicates by Channel ID
        const uniqueChannels = [];
        const seenIds = new Set();

        allSourceData.forEach(ch => {
            if (ch && ch.id && !seenIds.has(ch.id)) {
                seenIds.add(ch.id);
                uniqueChannels.push(ch);
            }
        });

        if (uniqueChannels.length > 0) {
            channels = uniqueChannels;
            renderChannels();
            // We only save back to cloud if we found NEW local-only data to merge
            if (newData?.data?.length !== uniqueChannels.length && localData.length > 0) {
                await saveData(); 
            }
        } else if (newData && Array.isArray(newData.data)) {
            // Cloud has an empty array explicitly saved by the user
            channels = newData.data;
        } else if (channels.length === 0) {
            // First time with completely empty cloud
            channels = defaultChannels;
        }

        isFirstLoad = false;
        renderChannels();
    } catch (err) {
        console.error('Aggressive Recovery failed:', err);
        isFirstLoad = false;
        renderChannels();
    }
}

async function saveData() {
    const dataToSave = JSON.stringify(channels);
    localStorage.setItem('yt_tracker_channels', dataToSave);
    updateLastActivity();

    try {
        const { error } = await supabase
            .from('channels')
            .upsert({ 
                id: 1, // Using numeric ID 1 for universal compatibility
                data: channels
            });
        if (error) {
            console.error('[Supabase Save Error]:', error);
            // Give specific hints instead of generic message
            if (error.code === '42P01') {
                showToast('⚠️ Supabase Error: "channels" table not found.');
            } else if (error.code === '42501' || error.message?.includes('policy') || error.message?.includes('permission')) {
                showToast('⚠️ Supabase RLS Policy: Insert/Update permission denied.');
            } else {
                showToast(`Cloud Sync: ${error.message || 'Connection lost'}`);
            }
        }
    } catch (err) {
        console.error('Save error:', err);
    }
}

function showToast(msg) {
    toast.textContent = msg;
    toast.classList.add('active');
    setTimeout(() => toast.classList.remove('active'), 3000);
}

// --- Settings Button Timer Logic (Real Clock Sync) ---
async function updateSettingsTimer() {
    const now = new Date();
    const interval = tgConfig.interval || 60;
    const intervalInMs = interval * 60 * 1000;
    
    // Calculate current interval block (e.g., which 60-min block we are in)
    const currentBlock = Math.floor(now.getTime() / intervalInMs);
    const lastSentBlock = parseInt(localStorage.getItem('last_tg_sent_block')) || 0;

    const timerBadge = document.getElementById('tg-timer-small');
    if (timerBadge) {
        if (lastSentBlock === 0) {
            // First load on this client: initialize block without unexpected auto-dispatch
            localStorage.setItem('last_tg_sent_block', currentBlock.toString());
            const nextBlockTime = (currentBlock + 1) * intervalInMs;
            const msLeft = nextBlockTime - now.getTime();
            const minsLeft = Math.max(1, Math.ceil(msLeft / 60000));
            timerBadge.textContent = `${minsLeft}m`;
            return;
        }

        if (currentBlock > lastSentBlock) {
            // It's time to sync! (Either exactly now or we missed it while sleeping)
            timerBadge.textContent = "SYNC";
            
            // Syncing...
            console.log(`Interval trigger! Block ${currentBlock} (Interval: ${interval}m)`);
            await sendTelegramUpdate();
            
            // Mark this block as sent locally
            localStorage.setItem('last_tg_sent_block', currentBlock.toString());
            
            // Sync to Cloud (Prevents Cron Job from double sending)
            await saveSyncBlock(currentBlock);

            // Update cloud for other devices to stay in sync
            lastTelegramSent = now.getTime();
            await saveMasterTimer(lastTelegramSent);
        } else {
            // Calculate time left in current block
            const nextBlockTime = (currentBlock + 1) * intervalInMs;
            const msLeft = nextBlockTime - now.getTime();
            const minsLeft = Math.ceil(msLeft / 60000);
            
            timerBadge.textContent = `${minsLeft}m`;
        }
    }
}

async function saveMasterTimer(timestamp) {
    try {
        await supabase
            .from('channels')
            .upsert({ 
                id: 2, 
                data: { last_sent: timestamp } 
            });
    } catch (err) {
        console.error('Timer cloud save failed:', err);
    }
}

async function saveTelegramConfig(config) {
    try {
        const { error } = await supabase
            .from('channels')
            .upsert({ 
                id: 3, 
                data: config 
            });
        if (error) {
            console.error('Config cloud save error:', error);
            showToast('⚠️ Could not save settings to database');
        } else {
            console.log('Telegram settings saved to database successfully');
        }
    } catch (err) {
        console.error('Config cloud save failed:', err);
        showToast('⚠️ Cloud connection failed');
    }
}

async function saveSyncBlock(block) {
    try {
        await supabase
            .from('channels')
            .upsert({ 
                id: 5, 
                data: block 
            });
    } catch (err) {
        console.error('Sync block save failed:', err);
    }
}

async function saveSyncTime(timestamp) {
    try {
        await supabase
            .from('channels')
            .upsert({ 
                id: 4, // Use numeric ID 4 for Last Sync Time
                data: timestamp 
            });
    } catch (err) {
        console.error('Sync time cloud save failed:', err);
    }
}

async function saveCloudSecretCode(code) {
    try {
        cloudSecretCode = code;
        await supabase
            .from('channels')
            .upsert({ 
                id: 6, // Slot 6 for Secret Code cloud sync across devices
                data: code 
            });
    } catch (err) {
        console.error('Cloud secret code save failed:', err);
    }
}

// --- QR Code Session Sharing & Auto-Authentication ---

function checkQrUrlParams() {
    try {
        const urlObj = new URL(window.location.href);
        const searchAuth = urlObj.searchParams.get('auth') || urlObj.searchParams.get('code') || urlObj.searchParams.get('key');
        const searchWord = urlObj.searchParams.get('word') || urlObj.searchParams.get('sec') || urlObj.searchParams.get('pw');
        
        let hashAuth = null;
        let hashWord = null;
        if (window.location.hash) {
            const hashParams = new URLSearchParams(window.location.hash.substring(1));
            hashAuth = hashParams.get('auth') || hashParams.get('code') || hashParams.get('key');
            hashWord = hashParams.get('word') || hashParams.get('sec') || hashParams.get('pw');
        }

        const authCode = searchAuth || hashAuth;
        const authWord = (searchWord || hashWord || '').toLowerCase().trim();

        if (authCode && /^[0-9]{6}$/.test(authCode)) {
            console.log('🔗 [QR Auto-Connect] Found 6-digit Secret Key in URL:', authCode);
            localStorage.setItem('user_secret_code', authCode);
            if (authWord) {
                localStorage.setItem('user_security_word', authWord);
            }
            updateLastActivity();
            
            // Clean URL query parameters without reloading so credentials are not kept in browser address bar
            const cleanUrl = window.location.origin + window.location.pathname;
            window.history.replaceState({}, document.title, cleanUrl);
            
            showToast('🎉 Connected via QR Code! Session authenticated across devices.');
        }
    } catch (err) {
        console.warn('URL Param Check error:', err);
    }
}

function generateSyncUrl() {
    const code = getStoredSecretCode() || '';
    const word = getStoredSecurityWord() || '';
    const origin = window.location.origin;
    const path = window.location.pathname;
    const params = new URLSearchParams();
    if (code) params.set('auth', code);
    if (word) params.set('word', word);
    const paramStr = params.toString();
    return paramStr ? `${origin}${path}?${paramStr}#${paramStr}` : `${origin}${path}`;
}

async function openQrSessionModal() {
    if (!qrModal) return;

    const currentCode = getStoredSecretCode();
    if (!currentCode) {
        showToast('⚠️ Please create/unlock your 6-digit Secret Code first.');
        showSecretGateModal('first_time');
        return;
    }

    if (qrSecretCodeDisplay) {
        qrSecretCodeDisplay.textContent = currentCode;
    }

    if (qrWordDisplay) {
        const storedWord = getStoredSecurityWord();
        qrWordDisplay.textContent = storedWord || '••••';
    }

    if (qrChannelCountDisplay) {
        qrChannelCountDisplay.textContent = `${channels.length} channel(s)`;
    }

    const syncUrl = generateSyncUrl();

    if (qrCodeCanvas) {
        try {
            await QRCode.toCanvas(qrCodeCanvas, syncUrl, {
                width: 150,
                margin: 1,
                color: {
                    dark: '#000000',
                    light: '#ffffff'
                },
                errorCorrectionLevel: 'M'
            });
        } catch (err) {
            console.error('QR Render failed:', err);
            showToast('Could not generate QR code image.');
        }
    }

    qrModal.classList.add('active');
    if (window.lucide && window.lucide.createIcons) {
        window.lucide.createIcons();
    }
}

function closeQrSessionModal() {
    if (qrModal) {
        qrModal.classList.remove('active');
    }
}

// --- Live QR Code Scanner (Camera & File Scanning) ---

function openQrScanner() {
    if (!qrScannerModal) return;
    qrScannerModal.classList.add('active');
    if (scannerFeedback) {
        scannerFeedback.textContent = 'Starting camera stream...';
        scannerFeedback.style.color = 'var(--text-secondary)';
    }
    startQrCamera();
    if (window.lucide && window.lucide.createIcons) window.lucide.createIcons();
}

async function closeQrScannerModal() {
    if (html5QrScanner) {
        try {
            await html5QrScanner.stop();
        } catch (e) {}
        try {
            html5QrScanner.clear();
        } catch (e) {}
        html5QrScanner = null;
    }
    if (qrScannerModal) {
        qrScannerModal.classList.remove('active');
    }
}

async function startQrCamera() {
    try {
        if (!html5QrScanner) {
            html5QrScanner = new Html5Qrcode("qr-reader");
        }

        const config = {
            fps: 10,
            qrbox: { width: 220, height: 220 }
        };

        await html5QrScanner.start(
            { facingMode: currentCameraFacing },
            config,
            (decodedText) => {
                handleQrScanResult(decodedText);
            },
            (error) => {
                // Ignore per-frame non-detection
            }
        );

        if (scannerFeedback) {
            scannerFeedback.textContent = 'Point camera at QR code on another screen';
            scannerFeedback.style.color = 'var(--accent)';
        }
    } catch (err) {
        console.warn('QR Camera start error:', err);
        if (scannerFeedback) {
            scannerFeedback.innerHTML = '⚠️ Camera blocked or unavailable. You can <strong>Upload QR Image</strong> below.';
            scannerFeedback.style.color = '#ef4444';
        }
    }
}

async function handleQrScanResult(decodedText) {
    if (!decodedText) return;
    console.log('📷 QR Scanned text:', decodedText);

    await closeQrScannerModal();

    let code = null;
    let word = null;

    try {
        if (decodedText.startsWith('http://') || decodedText.startsWith('https://')) {
            const urlObj = new URL(decodedText);
            code = urlObj.searchParams.get('auth') || urlObj.searchParams.get('code') || urlObj.searchParams.get('key');
            word = urlObj.searchParams.get('word') || urlObj.searchParams.get('sec') || urlObj.searchParams.get('pw');
            
            if (!code && urlObj.hash) {
                const hashParams = new URLSearchParams(urlObj.hash.substring(1));
                code = hashParams.get('auth') || hashParams.get('code') || hashParams.get('key');
                word = hashParams.get('word') || hashParams.get('sec') || hashParams.get('pw');
            }
        } else if (decodedText.startsWith('{')) {
            const json = JSON.parse(decodedText);
            code = json.code || json.auth;
            word = json.word;
        } else if (/^[0-9]{6}$/.test(decodedText.trim())) {
            code = decodedText.trim();
        }
    } catch (e) {
        console.warn('Failed parsing QR code:', e);
    }

    if (code && /^[0-9]{6}$/.test(code)) {
        if (gateCodeInput) gateCodeInput.value = code;
        if (word && gateWordInput) gateWordInput.value = word;
        if (channelSecretCodeInput) channelSecretCodeInput.value = code;

        showToast('📷 QR Code scanned successfully!');

        if (word) {
            // Direct login with credentials
            switchAccountGateTab('login');
            try {
                const accounts = await getCloudAccountsRegistry();
                const cleanWord = word.toLowerCase().trim();
                const matched = accounts.find(acc => acc.code === code && acc.word?.toLowerCase() === cleanWord);
                if (matched || (cloudSecretCode && cloudSecretCode === code)) {
                    localStorage.setItem('user_secret_code', code);
                    localStorage.setItem('user_security_word', cleanWord);
                    updateLastActivity();
                    closeSecretGateModal();
                    showToast('🔓 Logged in via QR Code! Dashboard unlocked.');
                    renderChannels();
                } else {
                    showSecretGateModal('login');
                    if (gateErrorMsg) {
                        gateErrorMsg.textContent = '❌ Account in QR code does not match database.';
                        gateErrorMsg.style.display = 'block';
                    }
                }
            } catch (err) {
                console.error('QR login verification error:', err);
            }
        } else {
            showSecretGateModal('login');
            if (gateWordInput) {
                gateWordInput.focus();
                showToast('Secret Code scanned. Enter your Security Word to finish login.');
            }
        }
    } else {
        showToast('⚠️ No valid Lassu account found in scanned QR.');
    }
}

// --- Entry Point ---
updateSettingsTimer();
setInterval(updateSettingsTimer, 10000);
init();
// Cloud Sync Trigger
