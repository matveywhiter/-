(function () {
    'use strict';

    var TS_CONFIG = {
        servers: [
            'http://77.110.96.33:443',
            'http://45.81.35.99:8443',
            'http://95.81.127.99:8443',
            'http://95.84.5.35:8090',
            'https://lam.maxvol.pro/ts',
            'https://ts.maxvol.pro/',
            'http://213.165.32.104:8443',
            'http://109.120.150.237:8443'
        ],
        timeout: 4000
    };

    // Флаг, чтобы не спамить проверками
    var isChecking = false;

    function selectBestServer() {
        if (isChecking) return;
        isChecking = true;

        var requests = TS_CONFIG.servers.map(function (url) {
            return new Promise(function (resolve) {
                var start = Date.now();
                var xhr = new XMLHttpRequest();
                xhr.open('GET', url + '/echo?rand=' + Math.random(), true);
                xhr.timeout = TS_CONFIG.timeout;

                xhr.onreadystatechange = function () {
                    if (xhr.readyState === 4) {
                        if (xhr.status === 200) {
                            resolve({ url: url, ping: Date.now() - start, ok: true });
                        } else {
                            resolve({ url: url, ok: false });
                        }
                    }
                };

                xhr.onerror = function () { resolve({ url: url, ok: false }); };
                xhr.ontimeout = function () { resolve({ url: url, ok: false }); };
                xhr.send();
            });
        });

        Promise.all(requests).then(function (results) {
            var active = results.filter(function (r) { return r.ok; });
            active.sort(function (a, b) { return a.ping - b.ping; });

            if (active.length > 0) {
                var best = active[0].url;
                
                if (window.Lampa && Lampa.Storage) {
                    // Читаем текущий сервер из памяти
                    var current = Lampa.Storage.get('torrserver_url', '');

                    // МЕНЯЕМ ТОЛЬКО ЕСЛИ ОН ДРУГОЙ
                    if (current !== best) {
                        Lampa.Storage.set('torrserver_url', best);
                        Lampa.Storage.set('torrserver_url_main', best);
                        Lampa.Storage.set('torrserver_use_link', 'one');
                        
                        if (Lampa.Noty) {
                            Lampa.Noty.show('TS Balancer: Выбран быстрый сервер ' + best);
                        }
                        console.log('TS-Balancer: Сервер изменен на ' + best);
                    } else {
                        console.log('TS-Balancer: Текущий сервер ' + current + ' оптимален.');
                    }
                }
            }
            isChecking = false;
        });
    }

    // Запуск только когда Lampa готова
    var waitLampa = setInterval(function() {
        if (window.Lampa && Lampa.Storage) {
            clearInterval(waitLampa);
            // Даем небольшую паузу в 1 секунду перед первой проверкой
            setTimeout(selectBestServer, 1000);
        }
    }, 500);

})();
