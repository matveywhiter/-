(function () {
    'use strict';

    function TorrServerAutoSwitch() {
        // Ваш список серверов
        var server_list = [
            'http://77.110.96.33:443',
            'http://45.81.35.99:8443',
            'http://95.81.127.99:8443'
        ];

        // Максимальное время ожидания ответа от сервера (в миллисекундах)
        var timeout_ms = 3000; 

        this.init = function () {
            // Запускаем проверку при старте Lampa
            if (window.appready) {
                this.checkServers();
            } else {
                Lampa.Listener.follow('app', function (e) {
                    if (e.type == 'ready') new TorrServerAutoSwitch().checkServers();
                });
            }
        };

        this.checkServers = function () {
            console.log('TS Balancer: Начинаю проверку серверов...');
            
            var promises = server_list.map(function (url) {
                return new Promise(function (resolve) {
                    var start_time = Date.now();
                    var controller = new AbortController();
                    var timeoutId = setTimeout(function() { controller.abort(); }, timeout_ms);

                    // Пытаемся получить ответ от /echo
                    fetch(url + '/echo', { 
                        method: 'GET',
                        signal: controller.signal
                    })
                    .then(function (response) {
                        clearTimeout(timeoutId);
                        if (response.ok) {
                            var duration = Date.now() - start_time;
                            resolve({ url: url, status: 'online', ping: duration });
                        } else {
                            resolve({ url: url, status: 'error', ping: 99999 });
                        }
                    })
                    .catch(function (err) {
                        clearTimeout(timeoutId);
                        resolve({ url: url, status: 'offline', ping: 99999 });
                    });
                });
            });

            Promise.all(promises).then(function (results) {
                // Оставляем только рабочие и сортируем по пингу (от меньшего к большему)
                var working_servers = results.filter(function(r) { 
                    return r.status === 'online'; 
                }).sort(function(a, b) { 
                    return a.ping - b.ping; 
                });

                if (working_servers.length > 0) {
                    var best = working_servers[0];
                    var current = Lampa.Storage.get('torrserver_url','');

                    // Если лучший сервер отличается от того, что сейчас стоит
                    if (current !== best.url) {
                        Lampa.Storage.set('torrserver_url', best.url);
                        Lampa.Storage.set('torrserver_url_main', best.url); // Для совместимости с разными версиями
                        
                        Lampa.Noty.show('TorrServer: Автопереключение на ' + best.url + ' (' + best.ping + 'ms)');
                        console.log('TS Balancer: Установлен сервер ' + best.url);
                    } else {
                        console.log('TS Balancer: Текущий сервер и так самый быстрый');
                    }
                } else {
                    Lampa.Noty.show('Внимание: Ни один TorrServer из списка не доступен!');
                }
            });
        };
    }

    new TorrServerAutoSwitch().init();
})();
