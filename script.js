(function () {
    'use strict';

    // Настройки
    var settings = {
        // Список серверов (ВАЖНО: если Lampa открыта через HTTPS, эти http ссылки могут блокироваться)
        servers: [
            'http://77.110.96.33:443',
            'http://45.81.35.99:8443',
            'http://95.81.127.99:8443'
        ],
        timeout: 3000 // Тайм-аут ожидания ответа (3 сек)
    };

    function startPlugin() {
        console.log('TorrServer Balancer: Плагин инициализирован');
        
        // Проверяем серверы
        checkServers();
    }

    function checkServers() {
        var promises = settings.servers.map(function (url) {
            return new Promise(function (resolve) {
                var start = Date.now();
                var xhr = new XMLHttpRequest();
                
                // Используем /echo для быстрой проверки
                xhr.open('GET', url + '/echo', true);
                xhr.timeout = settings.timeout;

                xhr.onload = function () {
                    if (xhr.status >= 200 && xhr.status < 300) {
                        resolve({ url: url, ping: Date.now() - start, status: true });
                    } else {
                        resolve({ url: url, ping: 9999, status: false });
                    }
                };

                xhr.onerror = function () { resolve({ url: url, ping: 9999, status: false }); };
                xhr.ontimeout = function () { resolve({ url: url, ping: 9999, status: false }); };

                xhr.send();
            });
        });

        Promise.all(promises).then(function (results) {
            var working = results.filter(function (r) { return r.status; });
            
            // Сортировка по пингу
            working.sort(function (a, b) { return a.ping - b.ping; });

            if (working.length > 0) {
                var best = working[0];
                console.log('TorrServer Balancer: Лучший сервер', best);
                
                // Установка в Lampa
                if (window.Lampa) {
                    var current = Lampa.Storage.get('torrserver_url','');
                    if(current !== best.url){
                         Lampa.Storage.set('torrserver_url', best.url);
                         Lampa.Storage.set('torrserver_url_main', best.url);
                         Lampa.Noty.show('TS Balancer: Выбран ' + best.url + ' (' + best.ping + 'ms)');
                    }
                }
            } else {
                console.log('TorrServer Balancer: Нет доступных серверов');
                if (window.Lampa) Lampa.Noty.show('TS Balancer: Все серверы недоступны!');
            }
        });
    }

    // Запуск плагина после загрузки Lampa
    if (window.appready) {
        startPlugin();
    } else {
        // Слушатель для старых и новых версий Lampa
        var eventListener = function(e) {
            if (e.type === 'ready') startPlugin();
        };
        
        if (window.Lampa && Lampa.Listener) {
            Lampa.Listener.follow('app', eventListener);
        } else {
            // Фолбек если API Lampa еще не загрузился
            window.addEventListener('load', function() {
                setTimeout(startPlugin, 2000); 
            });
        }
    }
})();
