$(document).ready(function () {
    // clear localStorage on load. Some clips have a expire time that needs to be refreshed and can not sit in localStorage for too long.
    localStorage.clear();
    console.log('Cleared localStorage');

    // Get API server from URL parameter (required - no hardcoded fallbacks to external services)
    function getApiServer() {
        const urlParams = new URLSearchParams(window.location.search);
        const apiParam = urlParams.get('api') || urlParams.get('apiServer');
        
        if (!apiParam) {
            console.error('[Clips] ERROR: No API server configured! Add ?api=YOUR_WORKER_URL to the URL');
            console.error('[Clips] See serverless/SETUP.md for instructions on deploying your own API proxy');
            return null;
        }
        
        return apiParam;
    }

    // Get the API server from URL
    const apiServer = getApiServer();
    
    // Abort if no API server configured
    if (!apiServer) {
        $('body').html('<div style="padding:20px;color:#ea2b1f;font-family:sans-serif;background:#1a1611;"><h2>⚠️ API Server Not Configured</h2><p>Add <code style="background:#3d3627;padding:2px 6px;border-radius:4px;">?api=YOUR_CLOUDFLARE_WORKER_URL</code> to the URL.</p><p>See <code style="background:#3d3627;padding:2px 6px;border-radius:4px;">serverless/SETUP.md</code> for setup instructions.</p></div>');
        return;
    }

    function getUrlParameter(name) {
        name = name.replace(/[\[]/, '\\[').replace(/[\]]/, '\\]');
        let regex = new RegExp('[\\?&]' + name + '=([^&#]*)');
        let results = regex.exec(location.search);
        return results === null ? '' : decodeURIComponent(results[1].replace(/\+/g, ' '));
    }

    // Array Shuffler
    function shuffleArray(arr) {
        arr.sort(() => Math.random() - 0.5);
    }

    // Get elements and remove elements
    function removeElements() {
        const textContainer = document.querySelectorAll("#text-container");
        const detailsContainer = document.querySelectorAll("#details-container");
        Array.from(textContainer).forEach((element) => element.remove());
        Array.from(detailsContainer).forEach((element) => element.remove());
    }

    // URL values
    let channel = getUrlParameter('channel').toLowerCase().trim();
    let mainAccount = getUrlParameter('mainAccount').toLowerCase().trim();
    let limit = getUrlParameter('limit').trim();
    let dateRange = getUrlParameter('dateRange').trim();
    let preferFeatured = getUrlParameter('preferFeatured').trim();
    let showText = getUrlParameter('showText').trim();
    let showDetails = getUrlParameter('showDetails').trim();
    let ref = getUrlParameter('ref').trim();
    let clientId = getUrlParameter('clientId').trim();
    let customText = getUrlParameter('customText').trim();
    let detailsText = getUrlParameter('detailsText').trim();
    let detailsPersist = getUrlParameter('detailsPersist').trim(); // Keep details visible whole video
    let detailsColor = getUrlParameter('detailsColor').trim(); // Custom background color
    let command = getUrlParameter('command').trim();
    let showFollowing = getUrlParameter('showFollowing').trim();
    let exclude = getUrlParameter('exclude').trim();
    let themeOption = getUrlParameter('themeOption').trim();
    let randomClip = 0; // Default random clip index
    let clip_index = 0; // Default clip index
    let following = "";
    let followCount = 0;
    let playCount = 0;
    let clips_json = "";
    let apiUrl;
    let asyncResponse;
    let chatConnect  = getUrlParameter('chatConnect').trim(); // If set to 'false' it will not connect to Twitch chat: &chatConnect=false

    const channel_keywords = ['http', 'https', 'twitch.tv'];

    channel_keywords.forEach(keyword => {
        if (channel.includes(keyword)) {
            console.log(`${channel} is not an expected string. Exiting code...`);
            throw new Error('Exiting code');
        }
        if (mainAccount.includes(keyword)) {
            console.log(`${mainAccount} is not an expected string. Exiting code...`);
            throw new Error('Exiting code');
        }
    });

    if (!chatConnect) {
        chatConnect = "true"; //default
    }

    if (!showDetails) {
        showDetails = "false"; //default
    }

    if (!preferFeatured) {
        preferFeatured = "false"; //default
    }

    if (!showFollowing) {
        showFollowing = "false"; //default
    }

    if (!exclude) {
        exclude = ""; //default
    }

    if (!showText) {
        showText = "false"; //default
    }

    if (!limit || limit === "0") {
        limit = "10"; //default
    }

    if (!dateRange || dateRange === "0") {
        dateRange = ""; //default
    } else {
        // Get client current date
        let todayDate = new Date();

        // subtract dateRange from todayDate
        let startDate = new Date(new Date().setDate(todayDate.getDate() - parseInt(dateRange)));

        // format dates
        startDate = startDate.toISOString().slice(0, 10);
        todayDate = todayDate.toISOString().slice(0, 10);

        // set the daterange url parameter for the api endpoint
        dateRange = "&start_date=" + startDate + "T00:00:00Z&end_date=" + todayDate + "T00:00:00Z";
    }

    let client = '';

    // Load theme css file if theme is set
    if (parseInt(themeOption) > 0) {
        $('head').append('<link rel="stylesheet" type="text/css" href="assets/css/theme' + themeOption + '.css">');
    }

    // If Auth token is set, then connect to chat using oauth, else connect anonymously.
    if (mainAccount > '' && ref > '' && chatConnect === 'true') {
        // Connect to twitch - needs auth token
        client = new tmi.Client({
            options: {
                debug: true,
                skipUpdatingEmotesets: true
            },
            connection: { reconnect: true },
            identity: {
                username: mainAccount,
                password: 'oauth:' + atob(ref)
            },
            channels: [mainAccount]
        });

        client.connect().catch(console.error);

    } else if (mainAccount > '' && ref == '' && chatConnect === 'true') {
        // Connect to twitch anonymously - does not need auth token
        client = new tmi.Client({
            options: {
                debug: true,
                skipUpdatingEmotesets: true
            },
            connection: { reconnect: true },
            channels: [mainAccount]
        });

        client.connect().catch(console.error);
    } else {
        chatConnect === 'false';
    }

    // Get game details function
    function game_by_id(game_id) {
        let jsonParse = JSON.parse($.getJSON({
            'url': apiServer + "/game?id=" + game_id,
            'async': false
        }).responseText);

        return jsonParse;
    }

    if (showFollowing === 'true' && ref > '' && clientId > '') {

        function following_pagination(cursor) {
            let jsonParse;
            let apiUrl;

            if (cursor) {
                apiUrl = apiServer + "/following?channel=" + mainAccount + "&limit=100&ref=" + ref + "&after=" + cursor
            } else {
                apiUrl = apiServer + "/following?channel=" + mainAccount + "&limit=100&ref=" + ref
            }

            jsonParse = JSON.parse($.getJSON({
                'url': apiUrl,
                'async': false
            }).responseText);

            return jsonParse;
        }

        // Globals: following, followCount
        function concatFollowing(jsonData) {
            $.each(jsonData, function (i, val) {
                following += val['broadcaster_login'] + ",";
                followCount++;
            });
        }

        // Json following data - page 1
        let following_json = following_pagination();

        concatFollowing(following_json.data);

        // Start the Following pagination
        while (following_json.pagination['cursor']) {
            following_json = following_pagination(following_json.pagination['cursor']);
            concatFollowing(following_json.data);
        }

        // Remove the last comma from string
        following = following.replace(/,\s*$/, "");

        // Exclude channels from following
        let channelListArray = following.split(',');
        let excludeArray = exclude.split(',');
        channelListArray = channelListArray.filter(item => !excludeArray.includes(item));
        followList = channelListArray.join(',');

        // Set channel to equal following list/string
        channel = followList.split(',').map(element => element.trim());

    } else {

        // Convert string to an array/list
        channel = channel.split(',').map(element => element.trim());
    }

    // Randomly grab a channel from the list to start from
    if (channel.length > 0) {
        // shuffle the list of channel names
        shuffleArray(channel);
        clip_index = 0;
    }

    console.log(channel);

    // Create iframe pool for seamless clip transitions
    let curr_clip_iframe = null;
    const iframe_pool = [];
    const PRELOAD_COUNT = 3; // Pre-load 3 clips ahead
    
    // Initialize iframe pool
    for (let i = 0; i < PRELOAD_COUNT; i++) {
        const iframe = document.createElement('iframe');
        iframe.setAttribute('frameborder', '0');
        iframe.setAttribute('allowfullscreen', 'true');
        iframe.setAttribute('scrolling', 'no');
        iframe.setAttribute('allow', 'autoplay');
        iframe.style.width = '100%';
        iframe.style.height = '100%';
        iframe.style.position = 'absolute';
        iframe.style.top = '0';
        iframe.style.left = '0';
        iframe.style.display = 'none';
        iframe.id = `clip-iframe-${i}`;
        $(iframe).appendTo('#container');
        iframe_pool.push(iframe);
    }
    
    let current_iframe_index = 0;

    //if command is set
    if (command && chatConnect === 'true') {
        // triggers on message
        client.on('chat', (channel, user, message, self) => {

            if (self || !message.startsWith('!')) return;

            if (user['message-type'] === 'chat' && message.startsWith('!' + command) && (user.mod || user.username === mainAccount)) {

                console.log('Starting clips player using command: !' + command);

                // Remove element before loading the clip
                removeElements();

                // Properly remove video source
                let videoElement = document.querySelector("video");
                videoElement.pause();
                videoElement.removeAttribute("src"); // empty source
                videoElement.load();

                // Get second command. ie: stop
                let commandOption = message.split(' ')[1];

                // Stop the clips player
                if (commandOption === "stop") {
                    // Remove element before loading the clip
                    $('#container').empty();
                    window.location.reload();
                }

                // Plays clips when command is used
                loadClip(channel[clip_index]);
            }
        });

    } else {
        // Plays clips when scene is active
        if (channel.length > 1 && typeof channel[clip_index + 1] !== 'undefined') {
            preloadNextClip(channel[clip_index + 1]);
        }
        loadClip(channel[clip_index]);
    }

    // Hard-coded commands to control the current clip. Limited to mods and streamer
    // !clipskip, !clippause, !clipplay
    // Triggers on message
    if (chatConnect === 'true') {
        client.on('chat', (channel, user, message, self) => {
            const controlCommands = ["!clipskip", "!clippause", "!clipplay", "!clipreload"];
            const receivedCommand = message.toLowerCase().split(' ')[0];

            if (self || !message.startsWith('!')) return;

            if (user['message-type'] === 'chat' && controlCommands.includes(receivedCommand) && (user.mod || user.username === mainAccount)) {
                let videoElement = document.querySelector("video");

                switch (receivedCommand) {
                    case "!clipskip":
                        console.log("Skipping Clip");
                        nextClip(true); // skip clip
                        break;
                    case "!clippause":
                        console.log("Pausing Clip");
                        if (videoElement) videoElement.pause(); // pause clip
                        break;
                    case "!clipplay":
                        if (videoElement && videoElement.paused) {
                            console.log("Playing Clip");
                            videoElement.play(); // continue playing clip if was paused
                        }
                        break;
                    case "!clipreload":
                        // Remove element before loading the clip
                        $('#container').empty();
                        window.location.reload(); // Reload browser source
                        break;
                    default:
                        console.log(`Unknown command: ${command}`);
                        break;
                }
            }

        });
    }

    async function preloadNextClip(channelName) {

        if (localStorage.getItem(channelName) === null && typeof channelName !== 'undefined') {
            console.log('Preloading next clip: ' + channelName);

            try {
                if (preferFeatured !== "false") {
                    apiUrl = apiServer + "/clips?channel=" + channelName + "&prefer_featured=true&limit=" + limit + "&shuffle=true" + dateRange;
                } else {
                    apiUrl = apiServer + "/clips?channel=" + channelName + "&prefer_featured=false&limit=" + limit + "&shuffle=true" + dateRange;
                }

                // Perform an asynchronous fetch request
                asyncResponse = await fetch(apiUrl);
                clips_json = await asyncResponse.json();  // Parse the JSON response

                // If dateRange or preferFeatured is set but no clips are found or only 1 clip is found. Try to pull any clip. 
                if (clips_json.data.length === 0 && (dateRange > "" || preferFeatured !== "false")) {
                    asyncResponse = await fetch(`${apiServer}/clips?channel=${channelName}&limit=${limit}&shuffle=true`);
                    clips_json = await asyncResponse.json();  // Parse the JSON response
                    console.log('No clips found matching dateRange or preferFeatured filter. PULL ANY Clip found from: ' + channelName);
                }

                if (clips_json.data.length > 0) {
                    console.log('Set ' + channelName + ' in localStorage');
                    // Store the data in localStorage
                    localStorage.setItem(channelName, JSON.stringify(clips_json));
                }
            } catch (error) {
                console.error('Error while preloading clip:', error);
            }
        }
    }

    // Get and play the clip
    function loadClip(channelName) {

        // Remove element before loading the clip
        removeElements();

        // Json data - Ajax calls
        // if localstorage does not exist
        if (localStorage.getItem(channelName) === null && typeof channelName !== 'undefined') {
            try {
                if (preferFeatured !== "false") {
                    apiUrl = apiServer + "/clips?channel=" + channelName + "&prefer_featured=true&limit=" + limit + "&shuffle=true" + dateRange;
                } else {
                    apiUrl = apiServer + "/clips?channel=" + channelName + "&prefer_featured=false&limit=" + limit + "&shuffle=true" + dateRange;
                }

                clips_json = JSON.parse($.getJSON({
                    'url': apiUrl,
                    'async': false
                }).responseText);

                // If dateRange or preferFeatured is set but no clips are found or only 1 clip is found. Try to pull any clip. 
                if (clips_json.data.length === 0 && (dateRange > "" || preferFeatured !== "false")) {
                    clips_json = JSON.parse($.getJSON({
                        'url': apiServer + "/clips?channel=" + channelName + "&limit=" + limit + "&shuffle=true",
                        'async': false
                    }).responseText);

                    console.log('No clips found matching dateRange or preferFeatured filter. PULL ANY Clip found from: ' + channelName);
                }

                if (clips_json.data.length > 0) {
                    console.log('Set ' + channelName + ' in localStorage');
                    localStorage.setItem(channelName, JSON.stringify(clips_json));
                } else {
                    nextClip(true);
                }
            } catch (e) {
                // Sometimes the api returns an error. Usually when a channel no longer exists
                if (e.name === 'TypeError' || e.name === 'SyntaxError') {
                    console.error(e.name + ' found. Skipping...');
                    nextClip(true);
                    return false;
                }

                if (e.name === 'QuotaExceededError') {
                    console.error('LocalStorage Quota Exceeded. Please free up some space by deleting unnecessary data.');
                    // automatically clear localstorage if it exceeds the quota
                    localStorage.clear();
                    console.log('Cleared localStorage');
                    nextClip(true);
                    return false;
                } else {
                    console.error('An error occurred:', e);
                }
            }
        } else {
            // Retrieve the object from storage
            console.log('Pulling ' + channelName + ' from localStorage');
            clips_json = JSON.parse(localStorage.getItem(channelName));
        }

        // Grab a random clip index anywhere from 0 to the clips_json.data.length.
        if (channel.length > 1) {

            console.log('Using random selection logic instead of shuffle');
            randomClip = Math.floor((Math.random() * clips_json.data.length - 1) + 1);

        } else {

            // Play clips in the order they were recieved
            if (clips_json.data.length === 1 || clips_json.data.length === playCount) {

                playCount = 1;
                randomClip = playCount - 1;

                // If only one channel is being used with the clips player
            } else if (channel.length === 1) {

                playCount++;

                if (playCount >= 1) {
                    randomClip = playCount - 1;
                }

            } else {
                // Default
                randomClip = 0;

            }

        }

        // log output from each clip for debugging
        console.log('Playing clip Channel: ' + clips_json.data[randomClip]['broadcaster_name']);
        console.log('Playing clip Index: ' + randomClip);
        console.log('Playing clip Item: ' + clips_json.data[randomClip]['item']);
        console.log('Playing clip ID: ' + clips_json.data[randomClip]['id']);
        console.log('Data length: ' + clips_json.data.length)

        // Get current iframe from pool
        const iframe = iframe_pool[current_iframe_index];
        const clipId = clips_json.data[randomClip]['id'];
        const parentDomain = window.location.hostname || 'localhost';
        
        // Load clip in iframe with autoplay
        const embedUrl = `https://clips.twitch.tv/embed?clip=${clipId}&parent=${parentDomain}&autoplay=true&muted=false`;
        iframe.src = embedUrl;
        iframe.style.display = 'block';
        iframe.setAttribute('data-clip-id', clipId);
        iframe.setAttribute('data-duration', clips_json.data[randomClip]['duration'] || 30);
        
        // Hide previous iframe if exists
        if (curr_clip_iframe && curr_clip_iframe !== iframe) {
            curr_clip_iframe.style.display = 'none';
        }
        
        curr_clip_iframe = iframe;
        
        console.log('[Clips] Playing:', clipId, 'in iframe', current_iframe_index);
        
        // Pre-load next clips in hidden iframes
        preloadNextClipsInIframes();

        // Remove elements before loading the clip and clip details
        removeElements();

        // Show channel name on top of video
        if (showText === 'true') {
            if (customText) {
                // custom message to show on top of clip. includes {channel} name as a variable
                customText = getUrlParameter('customText').trim();
                customText = customText.replace("{channel}", clips_json.data[randomClip]['broadcaster_name']);
                $("<div id='text-container'><span class='title-text'>" + decodeURIComponent(customText) + "</span></div>").appendTo('#container');
            } else {
                $("<div id='text-container'><span class='title-text'>" + clips_json.data[randomClip]['broadcaster_name'] + "</span></div>").appendTo('#container');
            }
        }

        // Show clip details panel
        if (showDetails === 'true') {
            if (detailsText) {

                if (document.getElementById("details-container")) {
                    document.getElementById("details-container").remove();
                }

                // custom clip details text
                detailsText = getUrlParameter('detailsText').trim();
                detailsText = detailsText.replace("{channel}", clips_json.data[randomClip]['broadcaster_name']);

                // Show clip title if it exists
                if (detailsText.includes("{title}")) {
                    if (clips_json.data[randomClip]['title']) {
                        detailsText = detailsText.replace("{title}", clips_json.data[randomClip]['title']);
                    } else {
                        detailsText = detailsText.replace("{title}", "?");
                    }
                }

                // Get game name/title using the game_id from the clip's json data
                if (detailsText.includes("{game}")) {
                    // Show game title if it exists
                    if (clips_json.data[randomClip]['game_id']) {
                        let game = game_by_id(clips_json.data[randomClip]['game_id']);
                        detailsText = detailsText.replace("{game}", game.data[0]['name']);
                    } else {
                        detailsText = detailsText.replace("{game}", "?");
                    }
                }

                // Format created_at date
                if (detailsText.includes("{created_at}")) {
                    detailsText = detailsText.replace("{created_at}", moment(clips_json.data[randomClip]['created_at']).format("MMMM D, YYYY"));
                }

                if (detailsText.includes("{creator_name}")) {
                    detailsText = detailsText.replace("{creator_name}", clips_json.data[randomClip]['creator_name']);
                }

                let dText = "";

                // split on line breaks and create an array
                let separateLines = detailsText.split(/\r?\n|\r|\n/g);

                // interate over separateLines array
                separateLines.forEach(lineBreaks);

                // generate html for each linebreak/item in array
                function lineBreaks(item, index) {
                    dText += "<div class='details-text item-" + index + "'>" + item + "</div>";
                }

                const detailsDiv = $("<div id='details-container'>" + dText + "</div>");
                
                // Apply persist class if detailsPersist is true
                if (detailsPersist === 'true') {
                    detailsDiv.addClass('persist');
                }
                
                // Apply custom background color if provided
                if (detailsColor) {
                    detailsDiv.css('background', detailsColor);
                }
                
                detailsDiv.appendTo('#container');
            }
        }

        // Auto-advance after clip duration
        const duration = parseFloat(clips_json.data[randomClip]['duration'] || 30);
        setTimeout(() => {
            nextClip(false);
        }, (duration + 1) * 1000);
    }
    
    // Pre-load next clips in hidden iframes
    function preloadNextClipsInIframes() {
        const parentDomain = window.location.hostname || 'localhost';
        
        // Pre-load up to PRELOAD_COUNT clips ahead
        for (let i = 1; i < PRELOAD_COUNT; i++) {
            const futureIndex = (clip_index + i) % channel.length;
            const futureChannel = channel[futureIndex];
            const futureClipsJson = localStorage.getItem(futureChannel);
            
            if (!futureClipsJson) continue;
            
            try {
                const futureClipsData = JSON.parse(futureClipsJson);
                if (futureClipsData.data && futureClipsData.data.length > 0) {
                    const futureClip = futureClipsData.data[Math.floor(Math.random() * futureClipsData.data.length)];
                    const iframeIndex = (current_iframe_index + i) % PRELOAD_COUNT;
                    const iframe = iframe_pool[iframeIndex];
                    
                    // Pre-load clip in hidden iframe
                    const embedUrl = `https://clips.twitch.tv/embed?clip=${futureClip.id}&parent=${parentDomain}&autoplay=false&muted=true`;
                    iframe.src = embedUrl;
                    iframe.style.display = 'none';
                    
                    console.log('[Clips] Pre-loading:', futureClip.id, 'in iframe', iframeIndex);
                }
            } catch (e) {
                console.warn('[Clips] Failed to pre-load:', e);
            }
        }
    }

    function nextClip(skip = false) {

        // Move to next iframe in pool
        current_iframe_index = (current_iframe_index + 1) % PRELOAD_COUNT;

        if (clip_index < channel.length - 1) {
            clip_index += 1;
        } else {
            clip_index = 0;
        }

        if (skip === true) {
            // Skips to the next clip if a clip does not exist
            console.log("Skipping clip...");
            loadClip(channel[clip_index]);
            curr_clip.play();
        } else {
            if (channel.length > 1 && typeof channel[clip_index + 1] !== 'undefined') {
                preloadNextClip(channel[clip_index + 1]);
            }
            // Play a clip
            loadClip(channel[clip_index]);
            curr_clip.play();
        }
    }
});