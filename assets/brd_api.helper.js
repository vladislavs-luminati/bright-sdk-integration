// IMPORTANT NOTE:
// This file is a helper for integrating Bright SDK with your website.
// It is injected into your application by the Bright SDK Integration tool during the update process.
// It should NOT be modified because your changes will be overwritten during the next SDK update.

(function(){
    var debug = false;
    var verbose = false;
    var status_key = "bright_sdk.status";
    var status = localStorage.getItem(status_key);
    var sleep = ms=>new Promise(resolve=>setTimeout(resolve, ms));
    var print = function(...args){
        if (debug)
            console.log(...args);
    };
    var print_err = function(...args){
        debugger;
        if (verbose)
            console.error(...args);
    };
    var onceStatusChangeCallbacks = [];
    var start_tizen_service = function(){
        return new Promise(function(resolve, reject){
            var PICK = 'http://tizen.org/appcontrol/operation/pick';
            var pkg_id = tizen.application.getCurrentApplication().appInfo.packageId;
            var service_id = pkg_id + '.Service';
            var app_control_data = new tizen.ApplicationControlData('caller', ['ForegroundApp']);
            var app_control = new tizen.ApplicationControl(PICK, null, null, null, [app_control_data]);
            if (brd_api.set_alarm)
                brd_api.set_alarm(service_id);
            tizen.application.launchAppControl(app_control, service_id, resolve, reject);
        });
    };
    var inited = false;
    window.BrightSDK = {
        init: function(settings){
            return window.BrightSDK.startService().then(()=>{
                debug = settings.debug;
                verbose = settings.debug || settings.verbose;
                return new Promise(function(resolve, reject){
                    print('init with settings: %o', settings);
                    var on_status_change = settings.on_status_change;
                    settings.on_status_change = function(){
                        try {
                            var status = brd_api.get_status();
                            var value = status
                                ? status.value
                                    ? status.value.consent : status.consent
                                : null;
                            window.BrightSDK.onStatusChangeFn(value);
                            for (var i=0; i<onceStatusChangeCallbacks.length; i++)
                                onceStatusChangeCallbacks[i](value);
                            onceStatusChangeCallbacks = [];
                            if (on_status_change)
                                on_status_change(value);
                        } catch(e){ print_err(e); }
                    };
                    try {
                        brd_api.init(settings, {
                            on_failure: function(message){
                                print_err('init failure. Error: ', message);
                                reject();
                            },
                            on_success: function(){
                                print('init success');
                                inited = true;
                                resolve();
                            },
                        });
                    } catch(e){
                        print_err(e);
                        reject();
                    }
                });
            });
        },
        isInited: function(){ return inited; },
        enable: function(){
            return window.BrightSDK.showConsent();
        },
        disable: function(){
            return new Promise((resolve, reject)=>{
                BrightSDK.onceStatusChange(resolve, 'disableResolve', true);
                brd_api.opt_out({
                    on_failure: function(e){
                        print_err('opt_out failure', e);
                        reject();
                    },
                    on_success: function(){ print('opt_out success'); },
                });
            });
        },
        showConsent: function(){
            if (!window.BrightSDK.isInited() || !brd_api.show_consent)
            {
                print_err("show_consent not available, retry in 1 sec...");
                return sleep(1000).then(window.BrightSDK.showConsent);
            }
            return new Promise((resolve, reject)=>{
                BrightSDK.onceStatusChange(resolve, 'showConsentResolve', true);
                brd_api.show_consent({
                    on_failure: function(message){
                        print_err('show_consent failure: ', message);ß
                        reject(message);
                    },
                    on_success: function(){ print('show_consent success'); },
                });
            });
        },
        onceStatusChange: function(fn, label, append){
            if (!append)
                onceStatusChangeCallbacks = [];
            var index = onceStatusChangeCallbacks.length;
            onceStatusChangeCallbacks.push(function(value){
                print('calling once hook %d: %s', index, label);
                fn(value);
            });
        },
        onStatusChangeFn: function(value){
            print("BRD status changed ----- ", value);
            status = value ? "enabled" : "disabled";
            localStorage.setItem(status_key, status);
        },
        getStatus: function(){ return status; },
        getStatusObject: function(){ return brd_api.get_status(); },
        isEnabled: function(){ return status == 'enabled'; },
        startService: function(){
            if (window.tizen)
            {
                print('detected OS: Tizen');
                return start_tizen_service();
            }
            return Promise.resolve();
        },
    };
})();