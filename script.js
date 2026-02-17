(function () {
    'use strict';

    function TorrServerBalancer() {
        // Список ваших серверов
        var servers = [
            'http://77.110.96.33:443',
            'http://45.81.35.99:8443',
            'http://95.81.127.99:8443/'
        ];

        this.init = function () {
            var self = this;
            // Ждем готовности Lampa
            Lampa.Listener.follow('app', function (e) {
                if (e.type == 'ready') {
                    self.findBestServer();
                }
            });
        };

        this.findBestServer = function () {
            var promises = servers.map(function (url) {
                return new Promise(function (resolve) {
                    var start = Date.now();
                    // Проверяем эхо-запрос к TorrServer
                    fetch(url + '/api/v1/echo', { method: 'GET' })
                        .then(function (response) {
                            if (response.ok) {
                                resolve({ url: url, status: 'ok', ping: Date.now() - start });
                            } else {
                                resolve({ url: url, status: 'error' });
                            }
                        })
                        .catch(function () {
                            resolve({ url: url, status: 'error' });
                        });
                });
            });

            Promise.all(promises).then(function (results) {
                // Фильтруем рабочие и сортируем по минимальному пингу
                var working = results.filter(r => r.status === 'ok').sort((a, b) => a.ping - b.ping);

                if (working.length > 0) {
                    var best = working[0].url;
                    // Устанавливаем лучший сервер в настройки Lampa
                    Lampa.Storage.set('torrent_install_url', best);
                    Lampa.Noty.show('Выбран лучший TorrServer: ' + best + ' (Ping: ' + working[0].ping + 'ms)');
                    console.log('Balancer: Selected ' + best);
                } else {
                    Lampa.Noty.show('Ни один TorrServer не доступен!');
                }
            });
        };
    }

    // Регистрация плагина
    if (window.appready) {
        new TorrServerBalancer().init();
    } else {
        Lampa.Listener.follow('app', function (e) {
            if (e.type == 'ready') new TorrServerBalancer().init();
        });
    }
})();