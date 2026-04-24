(function () {
    'use strict';

    var API_URL = 'https://weather.api.wangxiansheng.com/xidorn.php';
    var cityCache = null;
    var cityPromise = null;

    function qs(id) { return document.getElementById(id); }

    function escapeHtml(value) {
        return String(value == null ? '' : value)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    function text(value, fallback) {
        var v = value == null ? '' : String(value);
        return v === '' ? (fallback || '--') : v;
    }

    function cityJsonPath() {
        return location.pathname.indexOf('/city/') >= 0 ? '../city.json' : './city.json';
    }

    function cityPagePrefix() {
        return location.pathname.indexOf('/city/') >= 0 ? './' : './city/';
    }

    function flattenCities(tree) {
        var list = [];
        (tree || []).forEach(function (province) {
            var provinceName = province.name || '';
            var provinceCode = province.city_code || '';
            if (provinceName && provinceCode) {
                list.push({
                    city_code: String(provinceCode),
                    name: provinceName,
                    full_name: provinceName,
                    province: provinceName,
                    parent_city: '',
                    level: 'province_root'
                });
            }
            (province.shi || province.children || []).forEach(function (city) {
                var cityName = city.city_name || city.name || '';
                var cityCode = city.city_code || city.code || city.cityCode || '';
                if (cityName && cityCode) {
                    list.push({
                        city_code: String(cityCode),
                        name: cityName,
                        full_name: provinceName + ' ' + cityName,
                        province: provinceName,
                        parent_city: cityName,
                        level: 'city'
                    });
                }
                (city.xian || city.children || []).forEach(function (area) {
                    var areaName = area.city_name || area.name || '';
                    var areaCode = area.city_code || area.code || area.cityCode || '';
                    if (areaName && areaCode) {
                        list.push({
                            city_code: String(areaCode),
                            name: areaName,
                            full_name: provinceName + ' ' + cityName + ' ' + areaName,
                            province: provinceName,
                            parent_city: cityName,
                            level: 'area'
                        });
                    }
                });
            });
        });
        return list;
    }

    function loadCities() {
        if (cityCache) return Promise.resolve(cityCache);
        if (cityPromise) return cityPromise;
        cityPromise = fetch(cityJsonPath(), { cache: 'force-cache' })
            .then(function (res) {
                if (!res.ok) throw new Error('city.json 读取失败');
                return res.json();
            })
            .then(function (tree) {
                cityCache = flattenCities(tree);
                return cityCache;
            })
            .catch(function (err) {
                console.error(err);
                cityCache = [];
                return cityCache;
            });
        return cityPromise;
    }

    function currentCityCode() {
        var match = location.pathname.match(/\/city\/([0-9]+)\.html(?:$|[?#])/);
        if (match) return match[1];
        var fileMatch = location.pathname.match(/([0-9]+)\.html(?:$|[?#])/);
        return fileMatch ? fileMatch[1] : '';
    }

    function findCityByCode(cities, code) {
        for (var i = 0; i < cities.length; i++) {
            if (cities[i].city_code === String(code)) return cities[i];
        }
        return null;
    }

    function matchCities(cities, keyword) {
        var kw = String(keyword || '').trim().toLowerCase();
        if (!kw) return [];
        return cities.filter(function (item) {
            return item.city_code.indexOf(kw) >= 0 ||
                item.name.toLowerCase().indexOf(kw) >= 0 ||
                item.full_name.toLowerCase().indexOf(kw) >= 0;
        }).sort(function (a, b) {
            var an = a.name === keyword ? 0 : (a.name.indexOf(keyword) === 0 ? 1 : 2);
            var bn = b.name === keyword ? 0 : (b.name.indexOf(keyword) === 0 ? 1 : 2);
            return an - bn;
        }).slice(0, 12);
    }

    function goCity(code) {
        if (!code) return;
        location.href = cityPagePrefix() + encodeURIComponent(code) + '.html';
    }

    function initCitySearch(options) {
        var input = qs(options.keywordId);
        var button = qs(options.buttonId);
        var box = qs(options.suggestionsId);
        if (!input || !button || !box) return;

        function render(items, keyword) {
            if (!String(keyword || '').trim()) {
                box.style.display = 'none';
                box.innerHTML = '';
                return;
            }
            if (!items.length) {
                box.innerHTML = '<div class="' + options.emptyClass + '">未找到相关城市</div>';
                box.style.display = 'block';
                return;
            }
            box.innerHTML = items.map(function (item) {
                return '<div class="' + options.itemClass + '" data-code="' + escapeHtml(item.city_code) + '">' +
                    '<div class="' + options.titleClass + '">' + escapeHtml(item.name) + '</div>' +
                    '<div class="' + options.metaClass + '">' + escapeHtml(item.full_name) + '</div>' +
                    '</div>';
            }).join('');
            box.style.display = 'block';
        }

        function searchNow() {
            var kw = input.value.trim();
            if (!kw) {
                input.focus();
                render([], kw);
                return;
            }
            loadCities().then(function (cities) {
                var items = matchCities(cities, kw);
                if (items.length) {
                    goCity(items[0].city_code);
                } else {
                    render([], kw);
                }
            });
        }

        input.addEventListener('input', function () {
            loadCities().then(function (cities) {
                render(matchCities(cities, input.value), input.value);
            });
        });
        input.addEventListener('keydown', function (e) {
            if (e.key === 'Enter') searchNow();
        });
        button.addEventListener('click', searchNow);
        box.addEventListener('click', function (e) {
            var item = e.target.closest('[data-code]');
            if (item) goCity(item.getAttribute('data-code'));
        });
        document.addEventListener('click', function (e) {
            if (!box.contains(e.target) && e.target !== input) {
                box.style.display = 'none';
            }
        });
        loadCities();
    }

    function weatherEmoji(weather) {
        weather = String(weather || '');
        if (weather.indexOf('雷') >= 0) return '⛈️';
        if (weather.indexOf('雨') >= 0) return '🌧️';
        if (weather.indexOf('雪') >= 0) return '❄️';
        if (weather.indexOf('晴') >= 0) return '☀️';
        if (weather.indexOf('多云') >= 0) return '⛅';
        if (weather.indexOf('阴') >= 0) return '☁️';
        if (weather.indexOf('雾') >= 0 || weather.indexOf('霾') >= 0) return '🌫️';
        return '🌤️';
    }

    function normalizeApiMessage(message) {
        return String(message || '接口返回错误')
            .replace(/加QQ群[:：]?608222884/g, 'lianxi@wangxiansheng.com 或微信 WxsSws')
            .replace(/QQ群[:：]?608222884/g, 'lianxi@wangxiansheng.com 或微信 WxsSws');
    }

    function summaryText(cityName, weather, temp, quality, aqi, humidity, windDir, windPower) {
        return '今天' + cityName + '天气为' + text(weather) + '，当前温度 ' + text(temp) + '°C，当前空气质量为' + text(quality) + '，AQI 为 ' + text(aqi) + '，湿度 ' + text(humidity) + '%，' + text(windDir, '') + text(windPower, '') + '。';
    }

    function indexMap(indexes) {
        var map = {};
        (indexes || []).forEach(function (item) {
            var name = String(item.name || '');
            ['穿衣','感冒','紫外线','晾晒','户外','洗车','污染','晨练','舒适度','旅游','钓鱼'].forEach(function (key) {
                if (name.indexOf(key) >= 0 && !map[key]) map[key] = item;
            });
        });
        return map;
    }

    function faqQuestion(key, city) {
        var questions = {
            '穿衣': '今天' + city + '出门穿什么比较舒服？',
            '感冒': '今天' + city + '出门需要注意保暖吗？',
            '紫外线': '今天' + city + '出门要防晒吗？',
            '晾晒': '今天' + city + '衣服好晾干吗？',
            '户外': '今天' + city + '适合出门活动吗？',
            '洗车': '今天' + city + '洗车会不会白洗？',
            '污染': '今天' + city + '空气好吗？',
            '晨练': '今天' + city + '早上适合锻炼吗？',
            '舒适度': '今天' + city + '体感怎么样？',
            '旅游': '今天' + city + '适合出去玩吗？',
            '钓鱼': '今天' + city + '钓鱼条件怎么样？'
        };
        return questions[key] || ('今天' + city + key + '怎么样？');
    }

    function buildFaq(cityName, data) {
        var weatherData = data.data || {};
        var air = weatherData.air || {};
        var expand = weatherData.expand || {};
        var indexes = weatherData.indexes || [];
        var faqs = [{
            q: '今天' + cityName + '天气怎么样？',
            a: summaryText(cityName, expand.weather, expand.stemp, air.quality, air.aqi, expand.humidity, expand.windDirection, expand.windPower)
        }];
        var map = indexMap(indexes);
        ['穿衣','感冒','紫外线','晾晒','户外','洗车','污染','晨练','舒适度','旅游','钓鱼'].forEach(function (key) {
            var item = map[key];
            if (!item) return;
            var value = text(item.value, '');
            var desc = text(item.description, '');
            var answer = value && desc ? (value + '，' + desc) : (desc || value);
            if (answer) faqs.push({ q: faqQuestion(key, cityName), a: answer });
        });
        return faqs;
    }

    function injectFaqJsonLd(cityName, data) {
        var faqs = buildFaq(cityName, data);
        var json = {
            '@context': 'https://schema.org',
            '@type': 'FAQPage',
            'mainEntity': faqs.map(function (item) {
                return {
                    '@type': 'Question',
                    'name': item.q,
                    'acceptedAnswer': { '@type': 'Answer', 'text': item.a }
                };
            })
        };
        var old = qs('faqJsonLd');
        if (old) old.remove();
        var script = document.createElement('script');
        script.type = 'application/ld+json';
        script.id = 'faqJsonLd';
        script.textContent = JSON.stringify(json);
        document.head.appendChild(script);
    }

    function fetchWeather(cityCode) {
        return fetch(API_URL + '?citycode=' + encodeURIComponent(cityCode), { cache: 'no-store' })
            .then(function (res) {
                if (!res.ok) throw new Error('接口返回异常 HTTP ' + res.status);
                return res.json();
            })
            .then(function (json) {
                if (Number(json.status || 0) !== 200) {
                    throw new Error(normalizeApiMessage(json.message || '接口返回错误'));
                }
                return json;
            });
    }

    function renderHero(city, data) {
        var hero = qs('weatherHero');
        if (!hero) return;
        var weatherData = data.data || {};
        var cityInfo = data.cityInfo || {};
        var air = weatherData.air || {};
        var expand = weatherData.expand || {};
        var cityName = cityInfo.city || city.name;
        hero.innerHTML = '' +
            '<div class="hero-top">' +
                '<div><h1>' + escapeHtml(cityName) + '</h1><div class="hero-sub">更新时间：' + escapeHtml(cityInfo.updateTime || expand.updateTime || '--') + '</div></div>' +
                '<div class="temp-box"><div class="temp">' + escapeHtml(text(expand.stemp)) + '°C</div><div class="weather-type">' + weatherEmoji(expand.weather) + ' ' + escapeHtml(text(expand.weather)) + '</div></div>' +
            '</div>' +
            '<div class="cards">' +
                metric('空气质量', air.quality) +
                metric('AQI', air.aqi) +
                metric('湿度', text(expand.humidity) + '%') +
                metric('风向', expand.windDirection) +
                metric('风力', expand.windPower) +
                metric('PM2.5 / PM10', text(air.pm25) + ' / ' + text(air.pm10)) +
            '</div>';
    }

    function metric(label, value) {
        return '<div class="metric"><div class="label">' + escapeHtml(label) + '</div><div class="value">' + escapeHtml(text(value)) + '</div></div>';
    }

    function showSection(id) {
        var el = qs(id);
        if (el) el.hidden = false;
        return el;
    }

    function renderSummary(city, data) {
        var weatherData = data.data || {};
        var air = weatherData.air || {};
        var expand = weatherData.expand || {};
        var cityName = (data.cityInfo && data.cityInfo.city) || city.name;
        var summary = summaryText(cityName, expand.weather, expand.stemp, air.quality, air.aqi, expand.humidity, expand.windDirection, expand.windPower);
        var box = qs('weatherSummary');
        if (box) {
            box.textContent = summary;
            showSection('summarySection');
        }
        if (air.suggest) {
            qs('airSuggest').textContent = air.suggest;
            showSection('airSection');
        }
    }

    function renderForecast(data) {
        var list = ((data.data || {}).forecast || []).slice(0, 10);
        var grid = qs('forecastGrid');
        if (!grid || !list.length) return;
        grid.innerHTML = list.map(function (item) {
            var dayWeather = (item.day && item.day.weather) || '--';
            var nightWeather = (item.night && item.night.weather) || '--';
            var ymd = item.ymd || '';
            var date = ymd.length >= 10 ? ymd.slice(5) : ymd;
            return '<article class="forecast-item">' +
                '<div class="date">' + escapeHtml(date + ' ' + text(item.week, '')) + '</div>' +
                '<div class="wx">' + weatherEmoji(dayWeather) + '</div>' +
                '<div class="meta">白天：' + escapeHtml(dayWeather) + '<br>夜间：' + escapeHtml(nightWeather) + '<br>' +
                escapeHtml(text(item.high)) + '<br>' + escapeHtml(text(item.low)) + '<br>AQI：' + escapeHtml(text(item.aqi)) + '<br>日出：' + escapeHtml(text(item.sunrise)) + '<br>日落：' + escapeHtml(text(item.sunset)) + '</div>' +
                '</article>';
        }).join('');
        showSection('forecastSection');
    }

    function renderHours(data) {
        var list = ((data.data || {}).hour24 || []).slice(0, 24);
        var grid = qs('hourGrid');
        if (!grid || !list.length) return;
        grid.innerHTML = list.map(function (item) {
            var timeValue = item.time || '';
            var displayTime = timeValue.length >= 10 ? timeValue.slice(8, 10) + ':00' : timeValue;
            return '<div class="hour-item"><div class="hour-time">' + escapeHtml(displayTime) + '</div>' +
                '<div class="hour-temp">' + escapeHtml(text(item.temperature)) + '°</div>' +
                '<div class="hour-weather">' + weatherEmoji(item.weather) + ' ' + escapeHtml(text(item.weather)) + '</div></div>';
        }).join('');
        showSection('hourSection');
    }

    function renderYesterday(data) {
        var item = (data.data || {}).yesterday || null;
        var box = qs('yesterdayCard');
        if (!box || !item) return;
        var day = item.day || {};
        var night = item.night || {};
        box.innerHTML = '' +
            '<div class="y-box"><div class="y-title">昨日概况</div><div class="y-date">' + escapeHtml(text(item.ymd, '') + ' ' + text(item.week, '')) + '</div>' +
            '<div class="y-main"><div class="y-temps"><div class="y-temp-block"><div class="y-temp-label">高温</div><div class="y-temp-value">' + escapeHtml(text(item.high)) + '</div></div>' +
            '<div class="y-temp-block"><div class="y-temp-label">低温</div><div class="y-temp-value">' + escapeHtml(text(item.low)) + '</div></div></div><div class="y-icon">' + weatherEmoji(day.weather) + '</div></div></div>' +
            '<div class="y-box"><div class="y-title">白天</div><div class="y-weather">天气：' + escapeHtml(text(day.weather)) + '<br>风向：' + escapeHtml(text(day.windDirection)) + '<br>风力：' + escapeHtml(text(day.windPower)) + '<br>提示：' + escapeHtml(text(day.notice)) + '</div></div>' +
            '<div class="y-box"><div class="y-title">夜间</div><div class="y-weather">天气：' + escapeHtml(text(night.weather)) + '<br>风向：' + escapeHtml(text(night.windDirection)) + '<br>风力：' + escapeHtml(text(night.windPower)) + '<br>提示：' + escapeHtml(text(night.notice)) + '</div></div>';
        showSection('yesterdaySection');
    }

    function renderIndexes(data) {
        var list = (data.data || {}).indexes || [];
        var grid = qs('indexesGrid');
        if (!grid || !list.length) return;
        grid.innerHTML = list.map(function (item) {
            return '<article class="index-item"><div class="badge">' + escapeHtml(text(item.value)) + '</div><h3>' + escapeHtml(text(item.name)) + '</h3><div class="sub-muted">' + escapeHtml(text(item.description)) + '</div></article>';
        }).join('');
        showSection('indexesSection');
    }

    function renderWeatherError(message) {
        var hero = qs('weatherHero');
        if (hero) hero.innerHTML = '<div class="error">天气接口读取失败：' + escapeHtml(normalizeApiMessage(message)) + '</div>';
    }

    function initCityWeather() {
        if (!document.body.querySelector('.page-city')) return;
        var code = currentCityCode();
        if (!code) {
            renderWeatherError('无法从当前 URL 识别城市编码');
            return;
        }
        loadCities().then(function (cities) {
            var city = findCityByCode(cities, code) || { city_code: code, name: '当前城市' };
            return fetchWeather(code).then(function (data) {
                renderHero(city, data);
                renderSummary(city, data);
                renderForecast(data);
                renderHours(data);
                renderYesterday(data);
                renderIndexes(data);
                injectFaqJsonLd((data.cityInfo && data.cityInfo.city) || city.name, data);
            });
        }).catch(function (err) {
            renderWeatherError(err.message || err);
        });
    }

    document.addEventListener('DOMContentLoaded', function () {
        initCitySearch({
            keywordId: 'keyword',
            buttonId: 'searchBtn',
            suggestionsId: 'suggestions',
            itemClass: 'suggestion-item',
            titleClass: 'suggestion-title',
            metaClass: 'suggestion-meta',
            emptyClass: 'suggestion-empty'
        });
        initCitySearch({
            keywordId: 'detailKeyword',
            buttonId: 'detailSearchBtn',
            suggestionsId: 'detailSuggestions',
            itemClass: 'detail-suggestion-item',
            titleClass: 'detail-suggestion-title',
            metaClass: 'detail-suggestion-meta',
            emptyClass: 'detail-suggestion-empty'
        });
        initCityWeather();
    });
})();
