/**
 * Strixun Stream Suite - Clips Player
 * Full-featured Twitch clips player with UI controls and real-time config
 * 
 * @version 1.0.0
 */

(function() {
    'use strict';

    // ============ Configuration ============
    const CONFIG_STORAGE_KEY = 'strixun_clips_config';
    const CLIPS_CACHE_KEY = 'strixun_clips_cache';
    
    // Default configuration
    const DEFAULT_CONFIG = {
        apiServer: '', // Will be set from environment or URL
        channels: [],
        mainChannel: '',
        limit: 20,
        dateRange: 0,
        preferFeatured: false,
        showChannelOverlay: true,
        showDetailsPanel: true,
        showClipInfo: true,
        customChannelText: '',
        detailsTemplate: '{title}\nPlaying {game}\nClipped by {creator_name}',
        volume: 100,
        autoPlay: true,
        shuffle: true,
        chatConnect: false,
        accessToken: '',
        showFollowing: false,
        excludeChannels: []
    };

    // ============ State ============
    const state = {
        config: { ...DEFAULT_CONFIG },
        clips: [],
        currentClipIndex: 0,
        currentChannelIndex: 0,
        channels: [],
        isPlaying: false,
        isLoading: false,
        tmiClient: null,
        gameCache: {},
        broadcastChannel: null
    };

    // ============ DOM Elements ============
    const elements = {};

    // ============ Initialization ============
    function init() {
        cacheElements();
        loadConfig();
        setupEventListeners();
        setupBroadcastChannel();
        parseUrlParams();
        
        // Set body mode based on URL
        const urlParams = new URLSearchParams(window.location.search);
        if (urlParams.get('overlay') === 'true') {
            document.body.classList.remove('dock-mode');
            document.body.classList.add('overlay-mode');
        }

        // Auto-start if configured
        if (state.config.channels.length > 0 || state.config.showFollowing) {
            startPlayer();
        }
    }

    function cacheElements() {
        elements.playerContainer = document.getElementById('playerContainer');
        elements.videoWrapper = document.getElementById('videoWrapper');
        elements.videoPlayer = document.getElementById('videoPlayer');
        elements.emptyState = document.getElementById('emptyState');
        elements.loadingState = document.getElementById('loadingState');
        elements.loadingText = document.getElementById('loadingText');
        elements.channelOverlay = document.getElementById('channelOverlay');
        elements.channelText = document.getElementById('channelText');
        elements.clipInfo = document.getElementById('clipInfo');
        elements.infoChannel = document.getElementById('infoChannel');
        elements.infoTitle = document.getElementById('infoTitle');
        elements.infoMeta = document.getElementById('infoMeta');
        elements.detailsPanel = document.getElementById('detailsPanel');
        elements.detailsTitle = document.getElementById('detailsTitle');
        elements.detailsGame = document.getElementById('detailsGame');
        elements.detailsMeta = document.getElementById('detailsMeta');
        elements.statusBadge = document.getElementById('statusBadge');
        elements.statusIcon = document.getElementById('statusIcon');
        elements.statusText = document.getElementById('statusText');
        elements.clipCounter = document.getElementById('clipCounter');
        elements.btnPrev = document.getElementById('btnPrev');
        elements.btnSkipBack = document.getElementById('btnSkipBack');
        elements.btnPlayPause = document.getElementById('btnPlayPause');
        elements.btnSkipForward = document.getElementById('btnSkipForward');
        elements.btnNext = document.getElementById('btnNext');
        elements.btnMute = document.getElementById('btnMute');
        elements.volumeSlider = document.getElementById('volumeSlider');
        elements.progressContainer = document.getElementById('progressContainer');
        elements.progressBar = document.getElementById('progressBar');
    }

    // ============ Configuration ============
    function loadConfig() {
        try {
            const stored = localStorage.getItem(CONFIG_STORAGE_KEY);
            if (stored) {
                const parsed = JSON.parse(stored);
                state.config = { ...DEFAULT_CONFIG, ...parsed };
            }
        } catch (e) {
            console.warn('Failed to load config from localStorage:', e);
        }
    }

    function saveConfig() {
        try {
            localStorage.setItem(CONFIG_STORAGE_KEY, JSON.stringify(state.config));
        } catch (e) {
            console.warn('Failed to save config to localStorage:', e);
        }
    }

    function parseUrlParams() {
        const params = new URLSearchParams(window.location.search);
        
        // API Server (required)
        if (params.has('api')) {
            state.config.apiServer = params.get('api');
        }

        // Channels
        if (params.has('channel')) {
            const channelStr = params.get('channel').toLowerCase().trim();
            if (channelStr) {
                state.config.channels = channelStr.split(',').map(c => c.trim()).filter(Boolean);
            }
        }

        // Main channel for chat
        if (params.has('mainChannel')) {
            state.config.mainChannel = params.get('mainChannel').toLowerCase().trim();
        }

        // Numeric params
        if (params.has('limit')) state.config.limit = Math.min(parseInt(params.get('limit')) || 20, 100);
        if (params.has('dateRange')) state.config.dateRange = parseInt(params.get('dateRange')) || 0;
        if (params.has('volume')) state.config.volume = parseInt(params.get('volume')) || 100;

        // Boolean params
        if (params.has('preferFeatured')) state.config.preferFeatured = params.get('preferFeatured') === 'true';
        if (params.has('showText')) state.config.showChannelOverlay = params.get('showText') === 'true';
        if (params.has('showDetails')) state.config.showDetailsPanel = params.get('showDetails') === 'true';
        if (params.has('showInfo')) state.config.showClipInfo = params.get('showInfo') === 'true';
        if (params.has('autoPlay')) state.config.autoPlay = params.get('autoPlay') !== 'false';
        if (params.has('shuffle')) state.config.shuffle = params.get('shuffle') !== 'false';
        if (params.has('chatConnect')) state.config.chatConnect = params.get('chatConnect') === 'true';
        if (params.has('showFollowing')) state.config.showFollowing = params.get('showFollowing') === 'true';

        // String params
        if (params.has('customText')) state.config.customChannelText = decodeURIComponent(params.get('customText'));
        if (params.has('detailsText')) state.config.detailsTemplate = decodeURIComponent(params.get('detailsText'));
        
        // Access token (base64 encoded)
        if (params.has('ref')) {
            try {
                state.config.accessToken = atob(params.get('ref'));
            } catch (e) {
                console.warn('Invalid access token format');
            }
        }

        // Exclude channels
        if (params.has('exclude')) {
            const excludeStr = params.get('exclude').toLowerCase().trim();
            if (excludeStr) {
                state.config.excludeChannels = excludeStr.split(',').map(c => c.trim()).filter(Boolean);
            }
        }

        // Apply volume
        if (elements.volumeSlider) {
            elements.volumeSlider.value = state.config.volume;
        }
        if (elements.videoPlayer) {
            elements.videoPlayer.volume = state.config.volume / 100;
        }
    }

    // ============ Event Listeners ============
    function setupEventListeners() {
        // Video events
        elements.videoPlayer.addEventListener('play', onVideoPlay);
        elements.videoPlayer.addEventListener('pause', onVideoPause);
        elements.videoPlayer.addEventListener('ended', onVideoEnded);
        elements.videoPlayer.addEventListener('timeupdate', onVideoTimeUpdate);
        elements.videoPlayer.addEventListener('loadstart', onVideoLoadStart);
        elements.videoPlayer.addEventListener('canplay', onVideoCanPlay);
        elements.videoPlayer.addEventListener('error', onVideoError);

        // Control buttons
        elements.btnPlayPause.addEventListener('click', togglePlayPause);
        elements.btnNext.addEventListener('click', () => playNextClip(true));
        elements.btnPrev.addEventListener('click', playPrevClip);
        elements.btnSkipBack.addEventListener('click', () => skipTime(-5));
        elements.btnSkipForward.addEventListener('click', () => skipTime(5));
        elements.btnMute.addEventListener('click', toggleMute);
        elements.volumeSlider.addEventListener('input', onVolumeChange);

        // Progress bar click
        elements.progressContainer.addEventListener('click', onProgressClick);

        // Keyboard shortcuts
        document.addEventListener('keydown', onKeyDown);
    }

    // ============ BroadcastChannel for Real-Time Config ============
    function setupBroadcastChannel() {
        try {
            state.broadcastChannel = new BroadcastChannel('strixun_clips_player');
            state.broadcastChannel.onmessage = handleBroadcastMessage;
        } catch (e) {
            console.warn('BroadcastChannel not supported, using localStorage events');
            window.addEventListener('storage', onStorageChange);
        }
    }

    function handleBroadcastMessage(event) {
        const { type, data } = event.data;
        
        switch (type) {
            case 'CONFIG_UPDATE':
                state.config = { ...state.config, ...data };
                saveConfig();
                applyConfigChanges(data);
                break;
            case 'PLAY':
                play();
                break;
            case 'PAUSE':
                pause();
                break;
            case 'NEXT':
                playNextClip(true);
                break;
            case 'PREV':
                playPrevClip();
                break;
            case 'RELOAD':
                reloadClips();
                break;
            case 'SET_VOLUME':
                setVolume(data.volume);
                break;
        }
    }

    function onStorageChange(event) {
        if (event.key === CONFIG_STORAGE_KEY && event.newValue) {
            try {
                const newConfig = JSON.parse(event.newValue);
                state.config = { ...state.config, ...newConfig };
                applyConfigChanges(newConfig);
            } catch (e) {
                console.warn('Failed to parse config update:', e);
            }
        }
    }

    function applyConfigChanges(changes) {
        if ('volume' in changes) {
            setVolume(changes.volume);
        }
        if ('channels' in changes || 'showFollowing' in changes) {
            reloadClips();
        }
    }

    // Expose methods for external control
    window.StrixunClipsPlayer = {
        play,
        pause,
        next: () => playNextClip(true),
        prev: playPrevClip,
        setVolume,
        updateConfig: (config) => {
            state.config = { ...state.config, ...config };
            saveConfig();
            applyConfigChanges(config);
        },
        reload: reloadClips,
        getState: () => ({ ...state })
    };

    // ============ Player Logic ============
    async function startPlayer() {
        showLoading('Initializing player...');
        
        try {
            // Build channel list
            await buildChannelList();
            
            if (state.channels.length === 0) {
                showEmpty();
                return;
            }

            // Shuffle channels if configured
            if (state.config.shuffle) {
                shuffleArray(state.channels);
            }

            // Setup chat if configured
            if (state.config.chatConnect && state.config.mainChannel) {
                setupTwitchChat();
            }

            // Start loading first clip
            state.currentChannelIndex = 0;
            await loadClipsForChannel(state.channels[0]);
            
        } catch (error) {
            console.error('Failed to start player:', error);
            showError(error.message);
        }
    }

    async function buildChannelList() {
        state.channels = [];

        if (state.config.showFollowing && state.config.accessToken && state.config.mainChannel) {
            showLoading('Fetching followed channels...');
            await fetchFollowingChannels();
        } else if (state.config.channels.length > 0) {
            state.channels = [...state.config.channels];
        }

        // Apply exclusions
        if (state.config.excludeChannels.length > 0) {
            state.channels = state.channels.filter(
                ch => !state.config.excludeChannels.includes(ch.toLowerCase())
            );
        }
    }

    async function fetchFollowingChannels() {
        if (!state.config.apiServer) {
            throw new Error('API server not configured');
        }

        const channels = [];
        let cursor = null;

        do {
            let url = `${state.config.apiServer}/following?channel=${state.config.mainChannel}&limit=100&ref=${btoa(state.config.accessToken)}`;
            if (cursor) url += `&after=${cursor}`;

            const response = await fetch(url);
            const data = await response.json();

            if (data.data) {
                data.data.forEach(follow => {
                    channels.push(follow.broadcaster_login || follow.broadcaster_name);
                });
            }

            cursor = data.pagination?.cursor;
        } while (cursor && channels.length < 700);

        state.channels = channels;
    }

    async function loadClipsForChannel(channelName) {
        if (!state.config.apiServer) {
            throw new Error('API server not configured');
        }

        showLoading(`Loading clips from ${channelName}...`);

        // Check cache first
        const cacheKey = `${CLIPS_CACHE_KEY}_${channelName}`;
        const cached = getCachedClips(cacheKey);
        if (cached) {
            state.clips = cached;
            playCurrentClip();
            return;
        }

        // Build API URL
        let url = `${state.config.apiServer}/clips?channel=${encodeURIComponent(channelName)}&limit=${state.config.limit}&shuffle=${state.config.shuffle}`;
        
        if (state.config.preferFeatured) {
            url += '&prefer_featured=true';
        }

        if (state.config.dateRange > 0) {
            const endDate = new Date();
            const startDate = new Date();
            startDate.setDate(endDate.getDate() - state.config.dateRange);
            url += `&start_date=${startDate.toISOString()}&end_date=${endDate.toISOString()}`;
        }

        try {
            const response = await fetch(url);
            const data = await response.json();

            if (data.error) {
                throw new Error(data.error);
            }

            if (!data.data || data.data.length === 0) {
                // No clips found, try without filters
                if (state.config.dateRange > 0 || state.config.preferFeatured) {
                    const fallbackUrl = `${state.config.apiServer}/clips?channel=${encodeURIComponent(channelName)}&limit=${state.config.limit}&shuffle=true`;
                    const fallbackResponse = await fetch(fallbackUrl);
                    const fallbackData = await fallbackResponse.json();
                    
                    if (fallbackData.data && fallbackData.data.length > 0) {
                        state.clips = fallbackData.data;
                        cacheClips(cacheKey, state.clips);
                        playCurrentClip();
                        return;
                    }
                }

                // Still no clips, skip to next channel
                console.log(`No clips found for ${channelName}, skipping...`);
                await playNextChannel();
                return;
            }

            state.clips = data.data;
            cacheClips(cacheKey, state.clips);
            playCurrentClip();

        } catch (error) {
            console.error(`Failed to load clips for ${channelName}:`, error);
            await playNextChannel();
        }
    }

    function getCachedClips(key) {
        try {
            const cached = sessionStorage.getItem(key);
            if (cached) {
                return JSON.parse(cached);
            }
        } catch (e) {
            // Cache miss or error
        }
        return null;
    }

    function cacheClips(key, clips) {
        try {
            sessionStorage.setItem(key, JSON.stringify(clips));
        } catch (e) {
            // Quota exceeded, clear and retry
            sessionStorage.clear();
        }
    }

    function playCurrentClip() {
        if (state.clips.length === 0) {
            showEmpty();
            return;
        }

        const clip = state.clips[state.currentClipIndex];
        if (!clip) {
            playNextClip(false);
            return;
        }

        // Show video element
        elements.videoPlayer.style.display = 'block';
        elements.emptyState.style.display = 'none';
        elements.loadingState.style.display = 'none';

        // Set video source
        elements.videoPlayer.poster = clip.thumbnail_url;
        elements.videoPlayer.src = clip.clip_url;
        elements.videoPlayer.volume = state.config.volume / 100;
        elements.videoPlayer.load();

        // Update UI
        updateClipInfo(clip);
        updateClipCounter();
        enableControls();

        // Auto-play if configured
        if (state.config.autoPlay) {
            elements.videoPlayer.play().catch(e => {
                console.warn('Autoplay prevented:', e);
                updateStatus('paused');
            });
        }
    }

    async function updateClipInfo(clip) {
        // Channel overlay
        if (state.config.showChannelOverlay) {
            let channelText = state.config.customChannelText || clip.broadcaster_name;
            channelText = channelText.replace('{channel}', clip.broadcaster_name);
            elements.channelText.textContent = channelText;
            elements.channelOverlay.style.display = 'block';
        } else {
            elements.channelOverlay.style.display = 'none';
        }

        // Bottom clip info
        if (state.config.showClipInfo) {
            elements.infoChannel.textContent = clip.broadcaster_name;
            elements.infoTitle.textContent = clip.title || 'Untitled Clip';
            elements.infoMeta.textContent = `${clip.view_count?.toLocaleString() || 0} views`;
            elements.clipInfo.style.display = 'block';
        } else {
            elements.clipInfo.style.display = 'none';
        }

        // Details panel
        if (state.config.showDetailsPanel) {
            let template = state.config.detailsTemplate || '{title}';
            template = template.replace('{channel}', clip.broadcaster_name);
            template = template.replace('{title}', clip.title || 'Untitled');
            template = template.replace('{creator_name}', clip.creator_name || 'Unknown');
            
            // Format date
            if (template.includes('{created_at}')) {
                const date = typeof moment !== 'undefined' 
                    ? moment(clip.created_at).format('MMMM D, YYYY')
                    : new Date(clip.created_at).toLocaleDateString();
                template = template.replace('{created_at}', date);
            }

            // Get game name
            if (template.includes('{game}')) {
                const gameName = await getGameName(clip.game_id);
                template = template.replace('{game}', gameName);
            }

            const lines = template.split('\n');
            elements.detailsTitle.textContent = lines[0] || '';
            elements.detailsGame.textContent = lines[1] || '';
            elements.detailsMeta.textContent = lines.slice(2).join(' • ');
            
            // Reset animation
            elements.detailsPanel.style.display = 'none';
            void elements.detailsPanel.offsetWidth; // Trigger reflow
            elements.detailsPanel.style.display = 'block';
        } else {
            elements.detailsPanel.style.display = 'none';
        }
    }

    async function getGameName(gameId) {
        if (!gameId) return 'Unknown Game';
        
        // Check cache
        if (state.gameCache[gameId]) {
            return state.gameCache[gameId];
        }

        try {
            const response = await fetch(`${state.config.apiServer}/game?id=${gameId}`);
            const data = await response.json();
            
            if (data.data && data.data.length > 0) {
                const gameName = data.data[0].name;
                state.gameCache[gameId] = gameName;
                return gameName;
            }
        } catch (e) {
            console.warn('Failed to fetch game name:', e);
        }

        return 'Unknown Game';
    }

    function updateClipCounter() {
        const total = state.clips.length;
        const current = state.currentClipIndex + 1;
        elements.clipCounter.textContent = `${current}/${total}`;
    }

    // ============ Playback Controls ============
    function play() {
        elements.videoPlayer.play().catch(console.warn);
    }

    function pause() {
        elements.videoPlayer.pause();
    }

    function togglePlayPause() {
        if (state.isPlaying) {
            pause();
        } else {
            play();
        }
    }

    async function playNextClip(userTriggered = false) {
        state.currentClipIndex++;

        if (state.currentClipIndex >= state.clips.length) {
            // Move to next channel
            await playNextChannel();
        } else {
            playCurrentClip();
        }
    }

    function playPrevClip() {
        if (state.currentClipIndex > 0) {
            state.currentClipIndex--;
            playCurrentClip();
        }
    }

    async function playNextChannel() {
        state.currentChannelIndex++;
        state.currentClipIndex = 0;

        if (state.currentChannelIndex >= state.channels.length) {
            // Loop back to start
            state.currentChannelIndex = 0;
            if (state.config.shuffle) {
                shuffleArray(state.channels);
            }
        }

        if (state.channels.length > 0) {
            await loadClipsForChannel(state.channels[state.currentChannelIndex]);
        } else {
            showEmpty();
        }
    }

    function skipTime(seconds) {
        elements.videoPlayer.currentTime += seconds;
    }

    function setVolume(volume) {
        state.config.volume = Math.max(0, Math.min(100, volume));
        elements.videoPlayer.volume = state.config.volume / 100;
        elements.volumeSlider.value = state.config.volume;
        updateMuteButton();
        saveConfig();
    }

    function onVolumeChange(e) {
        setVolume(parseInt(e.target.value));
    }

    function toggleMute() {
        if (elements.videoPlayer.muted || state.config.volume === 0) {
            elements.videoPlayer.muted = false;
            setVolume(100);
        } else {
            elements.videoPlayer.muted = true;
            updateMuteButton();
        }
    }

    function updateMuteButton() {
        const vol = elements.videoPlayer.muted ? 0 : state.config.volume;
        if (vol === 0) {
            elements.btnMute.textContent = '🔇';
        } else if (vol < 50) {
            elements.btnMute.textContent = '🔉';
        } else {
            elements.btnMute.textContent = '🔊';
        }
    }

    function onProgressClick(e) {
        const rect = elements.progressContainer.getBoundingClientRect();
        const percent = (e.clientX - rect.left) / rect.width;
        elements.videoPlayer.currentTime = percent * elements.videoPlayer.duration;
    }

    async function reloadClips() {
        sessionStorage.clear();
        state.clips = [];
        state.currentClipIndex = 0;
        state.currentChannelIndex = 0;
        await startPlayer();
    }

    // ============ Video Event Handlers ============
    function onVideoPlay() {
        state.isPlaying = true;
        updateStatus('playing');
        elements.btnPlayPause.textContent = '⏸';
    }

    function onVideoPause() {
        state.isPlaying = false;
        updateStatus('paused');
        elements.btnPlayPause.textContent = '▶';
    }

    function onVideoEnded() {
        playNextClip(false);
    }

    function onVideoTimeUpdate() {
        const percent = (elements.videoPlayer.currentTime / elements.videoPlayer.duration) * 100;
        elements.progressBar.style.width = `${percent}%`;
    }

    function onVideoLoadStart() {
        updateStatus('loading');
    }

    function onVideoCanPlay() {
        if (state.isPlaying) {
            updateStatus('playing');
        }
    }

    function onVideoError(e) {
        console.error('Video error:', e);
        // Skip to next clip on error
        setTimeout(() => playNextClip(false), 1000);
    }

    // ============ Keyboard Controls ============
    function onKeyDown(e) {
        switch (e.key) {
            case ' ':
            case 'k':
                e.preventDefault();
                togglePlayPause();
                break;
            case 'ArrowRight':
                e.preventDefault();
                skipTime(5);
                break;
            case 'ArrowLeft':
                e.preventDefault();
                skipTime(-5);
                break;
            case 'ArrowUp':
                e.preventDefault();
                setVolume(state.config.volume + 10);
                break;
            case 'ArrowDown':
                e.preventDefault();
                setVolume(state.config.volume - 10);
                break;
            case 'n':
            case 'N':
                playNextClip(true);
                break;
            case 'p':
            case 'P':
                playPrevClip();
                break;
            case 'm':
            case 'M':
                toggleMute();
                break;
        }
    }

    // ============ Twitch Chat Integration ============
    function setupTwitchChat() {
        if (!window.tmi) {
            console.warn('TMI.js not loaded, chat commands disabled');
            return;
        }

        const options = {
            options: { debug: false, skipUpdatingEmotesets: true },
            connection: { reconnect: true },
            channels: [state.config.mainChannel]
        };

        if (state.config.accessToken) {
            options.identity = {
                username: state.config.mainChannel,
                password: `oauth:${state.config.accessToken}`
            };
        }

        state.tmiClient = new tmi.Client(options);
        state.tmiClient.connect().catch(console.error);

        state.tmiClient.on('chat', (channel, user, message, self) => {
            if (self || !message.startsWith('!')) return;

            const isMod = user.mod || user.username === state.config.mainChannel;
            if (!isMod) return;

            const cmd = message.toLowerCase().split(' ')[0];

            switch (cmd) {
                case '!clipskip':
                    playNextClip(true);
                    break;
                case '!clippause':
                    pause();
                    break;
                case '!clipplay':
                    play();
                    break;
                case '!clipreload':
                    reloadClips();
                    break;
            }
        });
    }

    // ============ UI Helpers ============
    function showLoading(message = 'Loading...') {
        state.isLoading = true;
        elements.videoPlayer.style.display = 'none';
        elements.emptyState.style.display = 'none';
        elements.loadingState.style.display = 'flex';
        elements.loadingText.textContent = message;
        updateStatus('loading');
    }

    function showEmpty() {
        state.isLoading = false;
        elements.videoPlayer.style.display = 'none';
        elements.loadingState.style.display = 'none';
        elements.emptyState.style.display = 'flex';
        disableControls();
        updateStatus('ready');
    }

    function showError(message) {
        elements.emptyState.querySelector('.empty-state__title').textContent = 'Error';
        elements.emptyState.querySelector('.empty-state__text').textContent = message;
        elements.emptyState.querySelector('.empty-state__icon').textContent = '⚠️';
        showEmpty();
    }

    function updateStatus(status) {
        elements.statusBadge.className = 'status-badge ' + status;
        
        switch (status) {
            case 'playing':
                elements.statusIcon.textContent = '▶';
                elements.statusText.textContent = 'Playing';
                break;
            case 'paused':
                elements.statusIcon.textContent = '⏸';
                elements.statusText.textContent = 'Paused';
                break;
            case 'loading':
                elements.statusIcon.textContent = '⏳';
                elements.statusText.textContent = 'Loading';
                break;
            default:
                elements.statusIcon.textContent = '⏹';
                elements.statusText.textContent = 'Ready';
        }
    }

    function enableControls() {
        elements.btnPlayPause.disabled = false;
        elements.btnNext.disabled = false;
        elements.btnPrev.disabled = state.currentClipIndex === 0;
        elements.btnSkipBack.disabled = false;
        elements.btnSkipForward.disabled = false;
    }

    function disableControls() {
        elements.btnPlayPause.disabled = true;
        elements.btnNext.disabled = true;
        elements.btnPrev.disabled = true;
        elements.btnSkipBack.disabled = true;
        elements.btnSkipForward.disabled = true;
    }

    // ============ Utilities ============
    function shuffleArray(arr) {
        for (let i = arr.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [arr[i], arr[j]] = [arr[j], arr[i]];
        }
        return arr;
    }

    // ============ Start ============
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();

