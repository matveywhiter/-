(function () {
    'use strict';

    var CONFIG = {
        // ВСТАВЬТЕ ВАШ КЛЮЧ SHODAN ТУТ
        shodan_key: 'fQnKzzdjBblqbYHvPAYkuBKNuswxWS3d', 
        // Ваши проверенные серверы (резерв)
        static_servers: [
            'http://77.110.96.33:443',
            'http://45.81.35.99:8443',
            'http://95.81.127.99:8443'
        ],
        timeout: 4000
    };

    function BalancerWithShodan() {
        this.all_servers = [].concat(CONFIG.static_servers);

        this.init = function() {
            var self = this;
            console.log('TS-Balancer: Запуск с поддержкой Shodan');
            
            this.fetchFromShodan().then(function(dynamicServers) {
                self.all_servers = self.all_servers.concat(dynamicServers);
                // Убираем дубликаты
                self.all_servers = Array.from(new Set(self.all_servers));
                self.checkAndSetBest();
            });
        };

        // Функция получения данных из Shodan
        this.fetchFromShodan = function() {
            return new Promise(function(resolve) {
                if (!CONFIG.shodan_key || CONFIG.shodan_key === 'ВАШ_API_KEY_SHODAN') {
                    console.log('TS-Balancer: Shodan ключ не найден, использую только статику');
                    return resolve([]);
                }

                var query = encodeURIComponent('TorrServer MatriX');
                var url = 'https://api.shodan.io/shodan/host/search?key=' + CONFIG.shodan_key + '&query=' + query;

                var xhr = new XMLHttpRequest();
                xhr.open('GET', url, true);
                xhr.onload = function() {
                    try {
                        var res = JSON.parse(xhr.responseText);
                        var found = res.matches.map(function(item) {
                            return 'http://' + item.ip_str + ':' + item.port;
                        });
                        console.log('TS-Balancer: Shodan нашел серверов: ' + found.length);
                        resolve(found);
                    } catch (e) {
                        resolve([]);
                    }
                };
                xhr.onerror = function() { resolve([]); };
                xhr.send();
            });
        };

        this.checkAndSetBest = function() {
            var self = this;
            var promises = this.all_servers.map(function(url) {
                return new Promise(function(resolve) {
                    var start = Date.now();
                    var xhr = new XMLHttpRequest();
                    xhr.open('GET', url + '/echo', true);
                    xhr.timeout = CONFIG.timeout;
                    xhr.onreadystatechange = function() {
                        if (xhr.readyState === 4 && xhr.status === 200) {
                            resolve({ url: url, ping: Date.now() - start, ok: true });
                        } else if (xhr.readyState === 4) {
                            resolve({ url: url, ok: false });
                        }
                    };
                    xhr.onerror = function() { resolve({ ok: false }); };
                    xhr.send();
                });
            });

            Promise.all(promises).then(function(results) {
                var active = results.filter(function(r) { return r.ok; });
                active.sort(function(a, b) { return a.ping - b.ping; });

                if (active.length > 0) {
                    var best = active[0].url;
                    Lampa.Storage.set('torrserver_url', best);
                    Lampa.Storage.set('torrserver_url_main', best);
                    Lampa.Noty.show('TS-Balancer: Выбран сервер ' + best);
                }
            });
        };
    }

    // Запуск
    var wait = setInterval(function() {
        if (window.Lampa && Lampa.Storage) {
            clearInterval(wait);
            new BalancerWithShodan().init();
        }
    }, 1000);

})();
