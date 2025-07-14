document.addEventListener('DOMContentLoaded', () => {
    // Elements
    const locationInfo = document.getElementById('locationInfo');
    const connectionStatus = document.getElementById('connectionStatus');
    const connectionType = document.getElementById('connectionType');
    const downloadSpeed = document.getElementById('downloadSpeed');
    const latency = document.getElementById('latency');
    const networkQualityBar = document.getElementById('networkQualityBar');
    const mapCanvas = document.getElementById('map');
    const ctx = mapCanvas ? mapCanvas.getContext('2d', { alpha: false }) : null;
    const suggestionsContainer = document.getElementById('suggestionsContainer');
    const currentTimeElement = document.getElementById('current-time');
    const refreshBtn = document.getElementById('refreshBtn');
    const timeSlider = document.getElementById('timeSlider');
    const departureTime = document.getElementById('departureTime');
    const notification = document.getElementById('notification');
    const notificationMessage = document.getElementById('notificationMessage');
    const zoomInBtn = document.getElementById('zoomIn');
    const zoomOutBtn = document.getElementById('zoomOut');
    const locateMeBtn = document.getElementById('locateMe');
    const suggestionsLoading = document.getElementById('suggestionsLoading');

    // State
    let userLocation = null;
    let mapScale = 1;
    let mapPanX = 0;
    let mapPanY = 0;
    let isDragging = false;
    let lastX = 0;
    let lastY = 0;
    let lastWeatherUpdate = 0;
    let initialDistance = 0;

    // Initialize
    function init() {
        if (!ctx) {
            showNotification('Canvas not supported');
            return;
        }
        resizeCanvas();
        setupEventListeners();
        updateCurrentTime();
        checkNetwork();
        getLocation();
        setupIntersectionObserver();
        setupTabs();
        setInterval(updateCurrentTime, 60000);
        setInterval(checkWeatherUpdate, 300000); // Check weather every 5 minutes
        requestAnimationFrame(animate);
    }

    // Setup event listeners
    function setupEventListeners() {
        window.addEventListener('resize', resizeCanvas);
        if (refreshBtn) refreshBtn.addEventListener('click', refreshData);
        if (timeSlider) timeSlider.addEventListener('input', handleTimeSliderChange);
        if (departureTime) departureTime.addEventListener('change', handleDepartureTimeChange);

        // Map controls
        if (zoomInBtn) {
            zoomInBtn.addEventListener('click', () => {
                mapScale = Math.min(mapScale * 1.2, 3);
                showNotification('Map zoomed in');
            });
        }

        if (zoomOutBtn) {
            zoomOutBtn.addEventListener('click', () => {
                mapScale = Math.max(mapScale / 1.2, 0.5);
                showNotification('Map zoomed out');
            });
        }

        if (locateMeBtn) {
            locateMeBtn.addEventListener('click', () => {
                if (userLocation) {
                    mapPanX = 0;
                    mapPanY = 0;
                    mapScale = 1;
                    showNotification('Centered on your location');
                } else {
                    showNotification('Location not available');
                }
            });
        }

        // Map dragging
        if (mapCanvas) {
            mapCanvas.addEventListener('mousedown', startDragging);
            window.addEventListener('mousemove', drag);
            window.addEventListener('mouseup', stopDragging);

            // Touch events
            mapCanvas.addEventListener('touchstart', (e) => {
                if (e.touches.length === 1) {
                    startDragging(e.touches[0]);
                } else if (e.touches.length === 2) {
                    initialDistance = getTouchDistance(e);
                }
                e.preventDefault();
            }, { passive: false });

            mapCanvas.addEventListener('touchmove', (e) => {
                if (e.touches.length === 1) {
                    drag(e.touches[0]);
                } else if (e.touches.length === 2) {
                    const newDistance = getTouchDistance(e);
                    const zoomDelta = newDistance / initialDistance;
                    mapScale = Math.max(0.5, Math.min(mapScale * zoomDelta, 3));
                    initialDistance = newDistance;
                    showNotification(`Zoom: ${Math.round(mapScale * 100)}%`);
                }
                e.preventDefault();
            }, { passive: false });

            mapCanvas.addEventListener('touchend', stopDragging);

            // Wheel zoom
            mapCanvas.addEventListener('wheel', (e) => {
                if (e.ctrlKey) {
                    e.preventDefault();
                    mapScale = Math.max(0.5, Math.min(mapScale * (e.deltaY < 0 ? 1.1 : 0.9), 3));
                    showNotification(`Zoom: ${Math.round(mapScale * 100)}%`);
                }
            }, { passive: false });
        }
    }

    function getTouchDistance(e) {
        const dx = e.touches[0].clientX - e.touches[1].clientX;
        const dy = e.touches[0].clientY - e.touches[1].clientY;
        return Math.sqrt(dx * dx + dy * dy);
    }

    function startDragging(e) {
        isDragging = true;
        lastX = e.clientX;
        lastY = e.clientY;
    }

    function drag(e) {
        if (isDragging) {
            const dx = e.clientX - lastX;
            const dy = e.clientY - lastY;
            mapPanX += dx;
            mapPanY += dy;
            lastX = e.clientX;
            lastY = e.clientY;
        }
    }

    function stopDragging() {
        isDragging = false;
    }

    // Setup tabs
    function setupTabs() {
        const tabs = document.querySelectorAll('.tab');
        tabs.forEach(tab => {
            tab.addEventListener('click', () => {
                document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
                document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
                tab.classList.add('active');
                const tabId = tab.getAttribute('data-tab');
                const content = document.getElementById(`${tabId}-tab`);
                if (content) {
                    content.classList.add('active');
                    if (tabId === 'weather' && userLocation) {
                        loadWeatherData();
                    } else if (tabId === 'alt-routes' && userLocation) {
                        loadAlternativeRoutes();
                    }
                }
            });
        });
    }

    // Resize canvas
    function resizeCanvas() {
        if (mapCanvas) {
            mapCanvas.width = mapCanvas.offsetWidth * window.devicePixelRatio;
            mapCanvas.height = mapCanvas.offsetHeight * window.devicePixelRatio;
            mapCanvas.style.width = `${mapCanvas.offsetWidth}px`;
            mapCanvas.style.height = `${mapCanvas.offsetHeight}px`;
        }
    }

    // Update current time
    function updateCurrentTime() {
        const now = new Date();
        if (currentTimeElement) {
            currentTimeElement.textContent = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            currentTimeElement.setAttribute('datetime', now.toISOString());
        }
    }

    // Show notification
    function showNotification(message) {
        if (notification && notificationMessage) {
            notificationMessage.textContent = message;
            notification.classList.add('show');
            setTimeout(() => notification.classList.remove('show'), 3000);
        }
    }

    // Setup Intersection Observer
    function setupIntersectionObserver() {
        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    entry.target.classList.add('visible');
                    window.suggestionObserver.unobserve(entry.target);
                }
            });
        }, { threshold: 0.1 });
        window.suggestionObserver = observer;
    }

    // Network check
    function checkNetwork() {
        if (navigator.connection) {
            simulateLatencyCheck().then(latencyMs => {
                updateNetworkInfo(navigator.connection, latencyMs);
                navigator.connection.addEventListener('change', () => {
                    simulateLatencyCheck().then(latencyMs => {
                        updateNetworkInfo(navigator.connection, latencyMs);
                        showNotification(`Network changed to ${navigator.connection.effectiveType || 'Unknown'}`);
                    });
                });
            }).catch(() => {
                if (connectionStatus) {
                    connectionStatus.innerHTML = '<i class="fas fa-exclamation-triangle"></i> Network check failed';
                    connectionStatus.className = 'connection-status poor';
                }
                showNotification('Network check failed');
            });
        } else {
            if (connectionStatus) {
                connectionStatus.innerHTML = '<i class="fas fa-exclamation-triangle"></i> Network information not available';
                connectionStatus.className = 'connection-status fair';
            }
            showNotification('Network information not available');
        }
    }

    function simulateLatencyCheck() {
        return new Promise((resolve, reject) => {
            const start = performance.now();
            setTimeout(() => {
                if (!navigator.onLine) {
                    reject(new Error('Offline'));
                    return;
                }
                let latency = performance.now() - start;
                if (navigator.connection) {
                    if (navigator.connection.effectiveType.includes('2g')) {
                        latency += 200 + Math.random() * 300;
                    } else if (navigator.connection.effectiveType.includes('3g')) {
                        latency += 100 + Math.random() * 200;
                    } else {
                        latency += 50 + Math.random() * 100;
                    }
                }
                resolve(Math.round(latency));
            }, 50);
        });
    }

    function updateNetworkInfo(connection, latencyMs) {
        let statusText, statusClass, quality;
        if (connection.effectiveType.includes('4g') && connection.downlink > 5) {
            statusText = 'Excellent Connection';
            statusClass = 'good';
            quality = 90 - Math.min(latencyMs / 10, 30);
        } else if (connection.effectiveType.includes('4g') && connection.downlink > 2) {
            statusText = 'Good Connection';
            statusClass = 'good';
            quality = 75 - Math.min(latencyMs / 10, 25);
        } else if (connection.effectiveType.includes('3g') || connection.downlink > 1) {
            statusText = 'Fair Connection';
            statusClass = 'fair';
            quality = 50 - Math.min(latencyMs / 20, 20);
        } else {
            statusText = 'Poor Connection';
            statusClass = 'poor';
            quality = 30 - Math.min(latencyMs / 30, 15);
        }

        if (connectionStatus) {
            connectionStatus.innerHTML = `<i class="fas fa-${getConnectionIcon(connection.effectiveType)}"></i> ${statusText}`;
            connectionStatus.className = `connection-status ${statusClass}`;
        }
        if (connectionType) connectionType.textContent = connection.effectiveType || 'Unknown';
        if (downloadSpeed) downloadSpeed.textContent = connection.downlink ? `${connection.downlink} Mbps` : 'Unknown';
        if (latency) latency.textContent = `${latencyMs} ms`;
        if (networkQualityBar) animateValue(networkQualityBar, parseInt(networkQualityBar.style.width) || 0, quality, 1000);
    }

    function getConnectionIcon(effectiveType) {
        if (!effectiveType) return 'network-wired';
        if (effectiveType.includes('wifi')) return 'wifi';
        if (effectiveType.includes('4g') || effectiveType.includes('3g') || effectiveType.includes('2g')) return 'mobile-alt';
        return 'network-wired';
    }

    function animateValue(element, start, end, duration) {
        let startTimestamp = null;
        const step = (timestamp) => {
            if (!startTimestamp) startTimestamp = timestamp;
            const progress = Math.min((timestamp - startTimestamp) / duration, 1);
            const value = Math.floor(progress * (end - start) + start);
            element.style.width = `${value}%`;
            if (progress < 1) {
                window.requestAnimationFrame(step);
            }
        };
        window.requestAnimationFrame(step);
    }

    // Geolocation
    function getLocation() {
        if (navigator.geolocation) {
            if (locationInfo) {
                locationInfo.innerHTML = '<i class="fas fa-circle-notch fa-spin"></i> Detecting your location...';
            }
            navigator.geolocation.getCurrentPosition(
                (position) => {
                    userLocation = position.coords;
                    updateLocationInfo(position);
                    window.requestIdleCallback(() => {
                        calculateCommuteOptions(position.coords.latitude, position.coords.longitude);
                        loadTrafficData();
                        loadWeatherData();
                        loadAlternativeRoutes();
                    }, { timeout: 2000 });
                },
                (error) => {
                    if (locationInfo) {
                        locationInfo.innerHTML = `<i class="fas fa-exclamation-triangle"></i> Error getting location: ${error.message}`;
                    }
                    showNotification('Failed to get location');
                },
                {
                    enableHighAccuracy: true,
                    timeout: 10000,
                    maximumAge: 0
                }
            );

            navigator.geolocation.watchPosition(
                (position) => {
                    if (userLocation && 
                        (Math.abs(userLocation.latitude - position.coords.latitude) > 0.0001 ||
                         Math.abs(userLocation.longitude - position.coords.longitude) > 0.0001)) {
                        userLocation = position.coords;
                        updateLocationInfo(position);
                        showNotification('Your location has been updated');
                    }
                },
                (error) => {
                    console.error('Error watching position:', error);
                    showNotification('Error tracking location');
                },
                {
                    enableHighAccuracy: true,
                    maximumAge: 30000
                }
            );
        } else {
            if (locationInfo) {
                locationInfo.innerHTML = '<i class="fas fa-exclamation-triangle"></i> Geolocation not supported';
            }
            showNotification('Geolocation not supported by your browser');
        }
    }

    function updateLocationInfo(position) {
        const { latitude, longitude, accuracy } = position.coords;
        if (locationInfo) {
            locationInfo.innerHTML = `
                <div><strong>Latitude:</strong> ${latitude.toFixed(6)}</div>
                <div><strong>Longitude:</strong> ${longitude.toFixed(6)}</div>
                <div><strong>Accuracy:</strong> ±${Math.round(accuracy)} meters</div>
            `;
        }
    }

    // Weather data
    function loadWeatherData() {
        if (!userLocation) {
            if (document.getElementById('weatherInfo')) {
                document.getElementById('weatherInfo').innerHTML = '<p>Location required for weather data</p>';
            }
            return;
        }

        // Simulate weather API call (replace with real API in production)
        setTimeout(() => {
            // Mock weather data based on time and location
            const now = new Date();
            const hour = now.getHours();
            const tempC = 20 + Math.sin(hour / 24 * Math.PI * 2) * 5; // Varies between 15-25°C
            const tempF = (tempC * 9/5) + 32;
            const condition = hour >= 6 && hour <= 18 ? 'Sunny' : 'Clear';
            const icon = hour >= 6 && hour <= 18 ? '☀️' : '🌙';
            const windSpeed = (5 + Math.random() * 5).toFixed(1);
            const windDir = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'][Math.floor(Math.random() * 8)];

            const weatherInfo = document.getElementById('weatherInfo');
            if (weatherInfo) {
                weatherInfo.innerHTML = `
                    <div class="weather-container">
                        <div class="weather-icon">${icon}</div>
                        <div>
                            <h3 style="margin: 0;">${condition}</h3>
                            <p style="margin: 0;">${tempF.toFixed(1)}°F (${tempC.toFixed(1)}°C)</p>
                            <p style="margin: 0;">Wind: ${windSpeed} mph ${windDir}</p>
                        </div>
                    </div>
                    <p style="margin-top: 10px;">
                        ${condition === 'Sunny' ? 'Perfect weather for commuting' : 'Clear night, safe for travel'}
                    </p>
                `;
                lastWeatherUpdate = Date.now();

                // Add click interaction
                const weatherIcon = document.querySelector('.weather-icon');
                if (weatherIcon) {
                    weatherIcon.addEventListener('click', () => {
                        weatherIcon.style.transform = 'scale(1.2)';
                        setTimeout(() => weatherIcon.style.transform = 'scale(1)', 200);
                        showNotification('Weather data refreshed');
                        loadWeatherData();
                    });
                }
            }
        }, 500);
    }

    function checkWeatherUpdate() {
        if (Date.now() - lastWeatherUpdate > 300000 && userLocation) {
            loadWeatherData();
        }
    }

    function refreshData() {
        if (refreshBtn) refreshBtn.innerHTML = '<i class="fas fa-circle-notch fa-spin"></i> Refreshing';
        checkNetwork();
        if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(
                (position) => {
                    userLocation = position.coords;
                    updateLocationInfo(position);
                    calculateCommuteOptions(position.coords.latitude, position.coords.longitude);
                    loadWeatherData();
                    loadAlternativeRoutes();
                    setTimeout(() => {
                        if (refreshBtn) refreshBtn.innerHTML = '<i class="fas fa-sync-alt"></i> Refresh';
                        showNotification('Data refreshed successfully');
                    }, 1000);
                },
                (error) => {
                    if (locationInfo) {
                        locationInfo.innerHTML = `<i class="fas fa-exclamation-triangle"></i> Error refreshing location: ${error.message}`;
                    }
                    if (refreshBtn) refreshBtn.innerHTML = '<i class="fas fa-sync-alt"></i> Refresh';
                    showNotification('Failed to refresh location');
                }
            );
        } else {
            if (refreshBtn) refreshBtn.innerHTML = '<i class="fas fa-sync-alt"></i> Refresh';
            showNotification('Geolocation not supported');
        }
    }

    function handleTimeSliderChange(e) {
        const hour = parseInt(e.target.value);
        const timeString = `${hour % 12 === 0 ? 12 : hour % 12}:00 ${hour >= 12 ? 'PM' : 'AM'}`;
        if (departureTime) departureTime.value = `${hour.toString().padStart(2, '0')}:00`;
        showNotification(`Updated to ${timeString} departure`);
        if (userLocation) {
            window.requestIdleCallback(() => {
                calculateCommuteOptions(userLocation.latitude, userLocation.longitude, hour);
            });
        }
    }

    function handleDepartureTimeChange(e) {
        const [hours, minutes] = e.target.value.split(':').map(Number);
        if (timeSlider) timeSlider.value = hours;
        showNotification(`Updated to ${e.target.value} departure`);
        if (userLocation) {
            window.requestIdleCallback(() => {
                calculateCommuteOptions(userLocation.latitude, userLocation.longitude, hours);
            });
        }
    }

    function calculateCommuteOptions(lat, lng, hour = 8) {
        if (suggestionsContainer) suggestionsContainer.innerHTML = '';
        if (suggestionsLoading) suggestionsLoading.classList.remove('hidden');
        window.requestIdleCallback(() => {
            setTimeout(() => {
                const tasks = generateSuggestions(lat, lng, hour);
                tasks.forEach((task, index) => {
                    window.requestIdleCallback(() => {
                        addSuggestion(task, index * 100);
                    }, { timeout: 1000 });
                });
                if (suggestionsLoading) suggestionsLoading.classList.add('hidden');
            }, 800);
        }, { timeout: 2000 });
    }

    function generateSuggestions(lat, lng, hour) {
        const isWeekend = [0, 6].includes(new Date().getDay());
        const network = navigator.connection ? navigator.connection.effectiveType : '4g';
        const canWorkRemote = network && (network.includes('4g') || network.includes('wifi'));
        let baseTime = 30;
        if (hour >= 7 && hour <= 9) baseTime = 45;
        if (hour >= 16 && hour <= 18) baseTime = 50;
        if (isWeekend) baseTime *= 0.8;
        baseTime += Math.random() * 10 - 5;

        return [
            { 
                name: "Leave Now", 
                time: `${Math.round(baseTime)}-${Math.round(baseTime * 1.3)} mins`, 
                description: isWeekend ? "Weekend traffic is lighter than usual" : "Typical commute time", 
                recommendation: "good",
                icon: "car",
                action: "startNavigation",
                details: {
                    route: "Standard route via Main St",
                    traffic: "Moderate",
                    fuel: `${(baseTime/10).toFixed(1)} liters`
                }
            },
            { 
                name: `Leave in ${30 - (hour % 30)} mins`, 
                time: `${Math.round(baseTime * 0.8)}-${Math.round(baseTime)} mins`, 
                description: "Traffic is expected to improve slightly", 
                recommendation: hour >= 16 && hour <= 18 ? "good" : "best",
                icon: "clock",
                action: "setReminder",
                details: {
                    route: "Standard route via Main St",
                    traffic: "Improving",
                    fuel: `${(baseTime*0.8/10).toFixed(1)} liters`
                }
            },
            canWorkRemote ? { 
                name: "Work Remotely", 
                time: "0 mins", 
                description: "Your network connection is suitable for remote work", 
                recommendation: "best",
                icon: "laptop-house",
                action: "remoteWork",
                details: {
                    connection: "Stable video call possible",
                    suggestion: "Schedule afternoon meetings"
                }
            } : null,
            { 
                name: "Alternative Route", 
                time: `${Math.round(baseTime * 0.9)}-${Math.round(baseTime * 1.1)} mins`, 
                description: "Slightly longer but more consistent", 
                recommendation: "fair",
                icon: "road",
                action: "showAlternative",
                details: {
                    route: "Via Highway 27 and 5th Ave",
                    traffic: "Light",
                    fuel: `${(baseTime*0.9/8).toFixed(1)} liters`
                }
            },
            { 
                name: "Public Transport", 
                time: `${Math.round(baseTime * 1.2)}-${Math.round(baseTime * 1.5)} mins`, 
                description: "Reliable but slower with walking segments", 
                recommendation: "fair",
                icon: "bus",
                action: "showTransit",
                details: {
                    route: "Bus #42 to Central Station",
                    schedule: "Every 15 mins",
                    cost: "$2.50"
                }
            }
        ].filter(Boolean);
    }

    function loadTrafficData() {
        setTimeout(() => {
            drawTrafficChart();
        }, 400);
    }

    function loadAlternativeRoutes() {
        setTimeout(() => {
            const altRoutesInfo = document.getElementById('altRoutesInfo');
            if (altRoutesInfo) {
                altRoutesInfo.innerHTML = `
                    <div style="margin-bottom: 10px; transition: all 0.3s ease;" class="route-option">
                        <h3 style="margin: 0;">Via Riverside Drive</h3>
                        <p style="margin: 0;">+5 minutes, but 20% less traffic</p>
                    </div>
                    <div style="margin-bottom: 10px;" class="route-option">
                        <h3 style="margin: 0;">Express Bus Lane</h3>
                        <p style="margin: 0;">Available 7-10AM, saves 10-15 minutes</p>
                    </div>
                    <div class="route-option">
                        <h3 style="margin: 0;">Bike Path</h3>
                        <p style="margin: 0;">35 minutes, healthy option</p>
                    </div>
                `;
                document.querySelectorAll('.route-option').forEach(option => {
                    option.addEventListener('click', () => {
                        option.style.transform = 'scale(1.02)';
                        setTimeout(() => option.style.transform = 'scale(1)', 200);
                        showNotification('Route selected');
                    });
                });
            }
        }, 600);
    }

    function drawTrafficChart() {
        const trafficChart = document.getElementById('trafficChart');
        if (!trafficChart) return;

        const canvas = document.createElement('canvas');
        canvas.width = 400 * window.devicePixelRatio;
        canvas.height = 150 * window.devicePixelRatio;
        canvas.style.width = '400px';
        canvas.style.height = '150px';
        trafficChart.innerHTML = '';
        trafficChart.appendChild(canvas);

        const ctx = canvas.getContext('2d', { alpha: false });
        if (!ctx) return;

        ctx.scale(window.devicePixelRatio, window.devicePixelRatio);

        ctx.fillStyle = '#f8f9fa';
        ctx.fillRect(0, 0, 400, 150);
        ctx.strokeStyle = '#e9ecef';
        ctx.lineWidth = 1;

        for (let y = 0; y <= 150; y += 30) {
            ctx.beginPath();
            ctx.moveTo(0, y);
            ctx.lineTo(400, y);
            ctx.stroke();
        }

        for (let x = 0; x <= 400; x += 400 / 6) {
            ctx.beginPath();
            ctx.moveTo(x, 0);
            ctx.lineTo(x, 150);
            ctx.stroke();
        }

        ctx.strokeStyle = '#f94144';
        ctx.lineWidth = 2;
        ctx.beginPath();

        const hours = 24;
        const points = [];

        for (let i = 0; i <= hours; i++) {
            let traffic = 20 + 
                30 * Math.exp(-Math.pow((i - 7.5)/2, 2)) +
                35 * Math.exp(-Math.pow((i - 17)/2, 2));
            traffic *= (0.9 + Math.random() * 0.2);
            const x = (i / hours) * 400;
            const y = 150 - (traffic / 100) * 150;
            points.push({x, y});
            i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
        }
        ctx.stroke();

        ctx.fillStyle = 'rgba(249, 65, 68, 0.1)';
        ctx.beginPath();
        ctx.moveTo(points[0].x, 150);
        points.forEach(point => ctx.lineTo(point.x, point.y));
        ctx.lineTo(points[points.length-1].x, 150);
        ctx.closePath();
        ctx.fill();

        const now = new Date();
        const currentHour = now.getHours() + now.getMinutes() / 60;
        const currentX = (currentHour / hours) * 400;
        ctx.strokeStyle = '#4361ee';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(currentX, 0);
        ctx.lineTo(currentX, 150);
        ctx.stroke();

        ctx.fillStyle = '#495057';
        ctx.font = '10px Arial';
        ctx.textAlign = 'center';
        for (let i = 0; i <= 24; i += 3) {
            ctx.fillText(`${i}:00`, (i / 24) * 400, 145);
        }

        ctx.font = 'bold 12px Arial';
        ctx.fillStyle = '#212529';
        ctx.fillText('Traffic Congestion Throughout the Day', 200, 15);
    }

    function animate() {
        if (userLocation && ctx) {
            drawMap();
        }
        requestAnimationFrame(animate);
    }

    function drawMap() {
        if (!ctx || !mapCanvas) return;

        ctx.clearRect(0, 0, mapCanvas.width, mapCanvas.height);
        ctx.save();
        ctx.translate(mapPanX, mapPanY);
        ctx.scale(mapScale, mapScale);

        ctx.fillStyle = '#a8d8ea';
        ctx.fillRect(-mapPanX/mapScale, -mapPanY/mapScale, mapCanvas.width/mapScale, mapCanvas.height/mapScale);
        
        // Draw road network
        ctx.strokeStyle = '#555';
        ctx.lineWidth = 6 / mapScale;
        ctx.beginPath();
        ctx.moveTo(50 / mapScale, mapCanvas.height/2 / mapScale);
        ctx.bezierCurveTo(
            150 / mapScale, mapCanvas.height/3 / mapScale,
            250 / mapScale, mapCanvas.height/2.5 / mapScale,
            mapCanvas.width-50 / mapScale, mapCanvas.height/2.3 / mapScale
        );
        ctx.stroke();
        
        ctx.lineWidth = 4 / mapScale;
        ctx.beginPath();
        ctx.moveTo(100 / mapScale, 100 / mapScale);
        ctx.lineTo(300 / mapScale, 100 / mapScale);
        ctx.stroke();
        
        ctx.beginPath();
        ctx.moveTo(200 / mapScale, 50 / mapScale);
        ctx.lineTo(200 / mapScale, 200 / mapScale);
        ctx.stroke();
        
        ctx.beginPath();
        ctx.moveTo(300 / mapScale, mapCanvas.height/2 / mapScale);
        ctx.lineTo(400 / mapScale, mapCanvas.height-100 / mapScale);
        ctx.stroke();
        
        ctx.fillStyle = '#333';
        ctx.font = `${12 / mapScale}px Arial`;
        ctx.fillText('Main St', 150 / mapScale, mapCanvas.height/3 / mapScale - 10 / mapScale);
        ctx.fillText('2nd Ave', 220 / mapScale, 120 / mapScale);
        
        // Draw points of interest
        ctx.fillStyle = '#8ac926';
        ctx.fillRect(250 / mapScale, 50 / mapScale, 80 / mapScale, 50 / mapScale);
        ctx.fillStyle = '#333';
        ctx.font = `${10 / mapScale}px Arial`;
        ctx.fillText('City Park', 290 / mapScale, 80 / mapScale);
        
        ctx.fillStyle = '#ffbe0b';
        ctx.fillRect(350 / mapScale, 150 / mapScale, 60 / mapScale, 40 / mapScale);
        ctx.fillStyle = '#333';
        ctx.fillText('Mall', 380 / mapScale, 170 / mapScale);
        
        // Draw user position
        ctx.fillStyle = 'red';
        ctx.beginPath();
        ctx.arc(100 / mapScale, mapCanvas.height/2 / mapScale, 10 / mapScale, 0, Math.PI * 2);
        ctx.fill();
        
        const pulseTime = Date.now() / 1000;
        const pulseSize = (Math.sin(pulseTime * 5) * 2 + 8) / mapScale;
        ctx.strokeStyle = 'rgba(255, 0, 0, 0.5)';
        ctx.lineWidth = 2 / mapScale;
        ctx.beginPath();
        ctx.arc(100 / mapScale, mapCanvas.height/2 / mapScale, pulseSize, 0, Math.PI * 2);
        ctx.stroke();
        
        ctx.fillStyle = '#333';
        ctx.font = `${12 / mapScale}px Arial`;
        ctx.fillText('You', 120 / mapScale, mapCanvas.height/2 / mapScale + 5 / mapScale);
        
        // Draw destination
        ctx.fillStyle = 'green';
        ctx.beginPath();
        ctx.arc(mapCanvas.width - 100 / mapScale, mapCanvas.height/2.3 / mapScale, 10 / mapScale, 0, Math.PI * 2);
        ctx.fill();
        
        ctx.fillStyle = '#333';
        ctx.font = `${12 / mapScale}px Arial`;
        ctx.fillText('Work', mapCanvas.width - 80 / mapScale, mapCanvas.height/2.3 / mapScale + 5 / mapScale);
        
        // Draw traffic
        const now = new Date();
        const hour = now.getHours();
        let trafficIntensity = ((hour >= 7 && hour <= 9) || (hour >= 16 && hour <= 18)) ? 3 : 1;
        ctx.fillStyle = 'rgba(220, 53, 69, 0.7)';
        
        for (let i = 0; i < 5 * trafficIntensity; i++) {
            const t = i / (5 * trafficIntensity);
            ctx.beginPath();
            ctx.arc((50 + t * (mapCanvas.width - 100)) / mapScale, (mapCanvas.height/2 + 30 * Math.sin(t * Math.PI * 2)) / mapScale, 4 / mapScale, 0, Math.PI * 2);
            ctx.fill();
        }
        
        for (let i = 0; i < 3 * trafficIntensity; i++) {
            const t = i / (3 * trafficIntensity);
            ctx.beginPath();
            ctx.arc((150 + t * 50) / mapScale, (mapCanvas.height/2 - t * 100) / mapScale, 3 / mapScale, 0, Math.PI * 2);
            ctx.fill();
        }
        
        ctx.restore();
    }

    function addSuggestion(task, delay) {
        setTimeout(() => {
            if (!suggestionsContainer) return;
            const suggestion = document.createElement('div');
            suggestion.className = 'suggestion-card';
            let borderColor = task.recommendation === 'best' ? '#28a745' : task.recommendation === 'good' ? '#28a745' : '#ffc107';
            if (task.recommendation === 'best') suggestion.classList.add('best-choice');
            suggestion.style.borderLeft = `4px solid ${borderColor}`;
            suggestion.innerHTML = `
                <div style="display: flex; align-items: center; margin-bottom: 10px;">
                    <i class="fas fa-${task.icon}" style="font-size: 1.5rem; margin-right: 10px; color: ${borderColor}; transition: transform 0.3s ease;"></i>
                    <h3 style="margin: 0;">${task.name}</h3>
                </div>
                <p style="margin: 5px 0;"><strong>Estimated time:</strong> ${task.time}</p>
                <p style="margin: 5px 0 10px;">${task.description}</p>
                <div style="background: #f8f9fa; padding: 10px; border-radius: 5px; margin-top: 10px;">
                    ${Object.entries(task.details).map(([key, value]) => `
                        <div style="display: flex; justify-content: space-between; margin-bottom: 5px;">
                            <span style="font-weight: 500;">${key.charAt(0).toUpperCase() + key.slice(1)}:</span>
                            <span>${value}</span>
                        </div>
                    `).join('')}
                </div>
                <button style="width: 100%; margin-top: 10px; background: ${borderColor};" 
                        onclick="window.handleSuggestionAction('${task.action}')">
                    ${getActionButtonText(task.action)}
                </button>
            `;
            suggestion.addEventListener('click', (e) => {
                if (e.target.tagName !== 'BUTTON') {
                    suggestion.querySelector('i').style.transform = 'scale(1.2)';
                    setTimeout(() => suggestion.querySelector('i').style.transform = 'scale(1)', 200);
                    window.handleSuggestionAction(task.action);
                }
            });
            suggestionsContainer.appendChild(suggestion);
            window.suggestionObserver.observe(suggestion);
        }, delay);
    }

    function getActionButtonText(action) {
        switch(action) {
            case 'startNavigation': return 'Start Navigation';
            case 'setReminder': return 'Set Reminder';
            case 'remoteWork': return 'Setup Remote Work';
            case 'showAlternative': return 'View Alternative';
            case 'showTransit': return 'View Transit Options';
            default: return 'Select Option';
        }
    }

    window.handleSuggestionAction = function(action) {
        switch(action) {
            case 'startNavigation':
                showNotification('Starting navigation to work...');
                break;
            case 'setReminder':
                showNotification('Reminder set for suggested departure time');
                break;
            case 'remoteWork':
                showNotification('Setting up your remote work environment...');
                break;
            case 'showAlternative':
                showNotification('Showing alternative route details');
                const altRoutesTab = document.querySelector('.tab[data-tab="alt-routes"]');
                if (altRoutesTab) altRoutesTab.click();
                break;
            case 'showTransit':
                showNotification('Showing public transport options');
                break;
            default:
                showNotification('Option selected');
        }
    };

    init();
});