// Vercel Sync Trigger v0.2.0
import { createClient } from '@supabase/supabase-js';

const BASE_URL = 'https://www.googleapis.com/youtube/v3';
const API_SYNC_INTERVAL = 900000; // 15 minutes

function escapeMarkdown(text) {
    if (!text) return '';
    return text.toString().replace(/[_*[\]()~`>#+\-=|{}.!\\]/g, '\\$&');
}

export default async function handler(req, res) {
    // 1. Setup Supabase (Checking both VITE_ and standard env names for compatibility)
    const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
    const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseKey) {
        return res.status(200).json({
            status: 'skipped',
            message: 'Supabase credentials not configured in environment variables.'
        });
    }

    const supabase = createClient(supabaseUrl, supabaseKey);
    
    try {
        // 2. Fetch All Config from Supabase
        const { data: channelRow } = await supabase.from('channels').select('data').eq('id', 1).maybeSingle();
        const { data: configRow } = await supabase.from('channels').select('data').eq('id', 3).maybeSingle();
        const { data: lastBlockRow } = await supabase.from('channels').select('data').eq('id', 5).maybeSingle();

        if (!channelRow?.data || !configRow?.data) {
            return res.status(200).json({ 
                status: 'error', 
                message: 'No config or channels found in Supabase. Open website and click SAVE in settings.' 
            });
        }

        let channels = channelRow.data;
        const tgConfig = configRow.data;
        const lastSentBlock = lastBlockRow?.data || 0;

        // 3. Time Check
        const interval = parseInt(tgConfig.interval) || 60;
        const intervalInMs = interval * 60 * 1000;
        const now = Date.now();
        const currentBlock = Math.floor(now / intervalInMs);

        // Allow force sync via URL query (?force=true) for testing
        const isForce = req?.query && (req.query.force === 'true' || req.query.force === true);
        if (currentBlock <= lastSentBlock && !isForce) {
            return res.status(200).json({ 
                status: 'skipped', 
                message: `Interval (${interval}m) not reached yet.`,
                next_sync_in: Math.ceil(((lastSentBlock + 1) * intervalInMs - now) / 60000) + ' mins'
            });
        }

        // 4. API Key setup
        const apiKeys = [
            process.env.VITE_YOUTUBE_API_KEY,
            process.env.YOUTUBE_API_KEY,
            process.env.VITE_YOUTUBE_API_KEY_2,
            process.env.VITE_YOUTUBE_API_KEY_3,
            process.env.VITE_YOUTUBE_API_KEY_4
        ].filter(k => k && k.startsWith('AIza'));
        
        const apiKey = apiKeys[0]; 
        if (!apiKey) throw new Error('No valid YouTube API Key found in server environment variables (VITE_YOUTUBE_API_KEY).');

        // 5. Sync YouTube (Batching)
        const ids = channels.map(c => c.id).filter(id => id && id.startsWith('UC')).join(',');
        if (ids) {
            const idArray = ids.split(',');
            let allChannelStats = [];
            
            // Fetch Channels (Subscribers)
            for (let i = 0; i < idArray.length; i += 50) {
                const chunk = idArray.slice(i, i + 50).join(',');
                const cRes = await fetch(`${BASE_URL}/channels?part=statistics&id=${chunk}&key=${apiKey}`);
                const cData = await cRes.json();
                if (cData.items) allChannelStats = allChannelStats.concat(cData.items);
            }

            // Fetch Videos (Views) - We only fetch latest video views for tracked channels
            const videoIds = channels.map(c => c.latestVideo?.id).filter(id => id);
            let videoStatsMap = new Map();
            for (let i = 0; i < videoIds.length; i += 50) {
                const vChunk = videoIds.slice(i, i + 50).join(',');
                const vRes = await fetch(`${BASE_URL}/videos?part=statistics&id=${vChunk}&key=${apiKey}`);
                const vData = await vRes.json();
                if (vData.items) {
                    vData.items.forEach(item => videoStatsMap.set(item.id, item.statistics.viewCount));
                }
            }

            // Update Array
            const today = new Date().toISOString().split('T')[0];
            channels = channels.map(ch => {
                const apiData = allChannelStats.find(item => item.id === ch.id);
                if (!apiData) return ch;

                const isHidden = apiData.statistics?.hiddenSubscriberCount;
                const newSubs = isHidden ? ch.subscribers : (parseInt(apiData.statistics?.subscriberCount || '0', 10) || ch.subscribers);
                const newViews = videoStatsMap.get(ch.latestVideo?.id) || ch.views || 0;
                let startDaySubs = ch.startDaySubs || newSubs;
                
                if (ch.lastResetDate !== today) {
                    startDaySubs = newSubs;
                }

                return {
                    ...ch,
                    subscribers: newSubs,
                    views: parseInt(newViews, 10) || 0,
                    startDaySubs: startDaySubs,
                    lastResetDate: today,
                    difference: newSubs - startDaySubs,
                    status: newSubs > ch.subscribers ? 'up' : (newSubs < ch.subscribers ? 'down' : 'neutral'),
                    lastSubCount: newSubs
                };
            });
        }

        // 6. Send Telegram Update
        const sorted = [...channels].sort((a, b) => b.subscribers - a.subscribers);
        const top3 = sorted.slice(0, 3);
        const timeStr = new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' });

        let message = `📊 *Lassu Cloud Report*\n⏰ ${timeStr}\n\n`;
        if (top3.length > 0) {
            message += `🏆 *Top Creators:*\n`;
            top3.forEach((ch, i) => {
                const cleanName = escapeMarkdown(ch.name);
                const diffStr = ch.difference !== 0 ? ` (${ch.difference > 0 ? '+' : ''}${ch.difference})` : '';
                message += `${i + 1}. ${cleanName}: ${ch.subscribers.toLocaleString()}${diffStr}\n`;
            });
        }
        message += `\n📱 Total: ${channels.length} channels tracked.`;

        const tgRes = await fetch(`https://api.telegram.org/bot${tgConfig.token}/sendMessage`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                chat_id: tgConfig.chatId,
                text: message,
                parse_mode: 'Markdown'
            })
        });

        const tgData = await tgRes.json();
        if (!tgData.ok) {
            console.error('Telegram API Error:', tgData);
            throw new Error(`Telegram Error: ${tgData.description}`);
        }

        // 7. Final Save back to Supabase
        // id 1: channels data
        // id 5: current block (prevents double sending)
        await supabase.from('channels').upsert({ id: 1, data: channels });
        await supabase.from('channels').upsert({ id: 5, data: currentBlock });

        return res.status(200).json({ 
            status: 'success', 
            message: 'Report sent to Telegram',
            block: currentBlock 
        });

    } catch (error) {
        console.error('Server Sync Error:', error);
        return res.status(500).json({ status: 'error', error: error.message });
    }
}

