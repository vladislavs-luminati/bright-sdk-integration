// LICENSE_CODE ZON
'use strict'; /*jslint node:true es9:true*/
const fs = require('fs');
const path = require('path');
const lib = require('./lib.js');

const {
    lbr,
    print: print_base, process_init, prompt, process_close,
    read_json, write_json, search_filename,
    download_from_url, unzip, set_json_props, replace_file,
} = lib;

const brd_api_name = 'brd_api.js';

const get_config_fname = appdir=>path.join(appdir, 'brd_sdk.config.json');

const process_webos =  async(opt={})=>{

const print = (...args)=>{
    if (opt.interactive || opt.verbose)
        print_base(...args);
};

const read_env = ()=>({
    js_dir: process.env.JS_DIR,
    appdir: process.env.APPDIR,
});

const read_config = (config, fname)=>{
    print(`Reading configuration file ${fname}...`);
    Object.assign(config, read_json(fname), read_env());
};

const get_value = async(question, def_answer, config_value)=>{
    if (!opt.interactive || config_value)
    {
        print(`${question}: ${config_value}`);
        return config_value;
    }
    return await prompt(question, def_answer);
};

const get_js_dir = async appdir=>{
    let def_value;
    const existing = await search_filename(appdir, brd_api_name);
    if (existing)
        def_value = path.dirname(existing);
    else
    {
        for (const name of ['src', 'source', 'js', '/'])
        {
            const dir = path.join(appdir, name);
            if (fs.existsSync(dir))
            {
                def_value = dir;
                break;
            }
        }
    }
    def_value = def_value || path.join(appdir);
    return def_value;
};

const config = {};
let prev_config_fname, appdir;
if (opt.interactive)
    process_init();
if (opt.config_fname)
{
    read_config(config, prev_config_fname = opt.config_fname);
    appdir = config.app_dir;
}
else if (opt.appdir)
    appdir = opt.appdir;

const greeting = `Welcome to BrightSDK Integration Code Generator for WebOS!`;

const instructions = `Press CTRL+C at any time to break execution.
NOTE: remember to save your uncommited changes first.
`;

print(greeting+lbr+instructions);
appdir = appdir || await get_value('Path to application directory', '',
    config.appdir);
if (!prev_config_fname)
{
    const fname = get_config_fname(appdir);
    if (fs.existsSync(fname))
        read_config(config, prev_config_fname = fname);
}
const sdk_ver = await get_value('SDK Version', '1.438.821', config.sdk_ver);
let workdir = config.workdir;
if (!workdir)
{
    const workdir_root = path.join(path.dirname(__dirname), '.build');
    if (!fs.existsSync(workdir_root))
        fs.mkdirSync(workdir_root);
    workdir = path.join(workdir_root, `${path.basename(appdir)}_${sdk_ver}`);
}
const js_dir = await get_value('Application JS directory',
    await get_js_dir(appdir),
    config.appdir && path.join(config.appdir, config.js_dir||''));
const js_name = js_dir == appdir ? '' : path.basename(js_dir);
const sdk_service_dir_def = path.join(appdir, 'service');
const sdk_service_dir = await get_value('SDK Service dir', sdk_service_dir_def,
    config.sdk_service_dir && path.join(config.appdir,
        config.sdk_service_dir));

const sdk_url_mask = await get_value('SDK URL mask',
    'https://path/to/sdk_SDK_VER.zip', config.sdk_url);
const sdk_url = sdk_url_mask.replace(/SDK_VER/, sdk_ver);
const sdk_zip = path.basename(sdk_url);
const sdk_zip_ext = path.extname(sdk_zip);
const sdk_zip_fname = path.join(workdir, sdk_zip);
const sdk_dir = path.join(workdir, path.basename(sdk_zip, sdk_zip_ext));
const appinfo = read_json(path.join(appdir, 'appinfo.json'));
const {id: appid} = appinfo;

print('Starting...');
if (!fs.existsSync(workdir))
    fs.mkdirSync(workdir);

await download_from_url(sdk_url, sdk_zip_fname);
print(`✔ Downloaded ${sdk_zip}`);

await unzip(sdk_zip_fname, sdk_dir);
print(`✔ SDK extracted into ${sdk_dir}`);

const sdk_service_fname = path.join(sdk_dir, 'sdk', 'service');
const brd_api_fname = path.join(sdk_dir, 'sdk', 'consent', brd_api_name);
const brd_api_dst_fname = path.join(js_dir, brd_api_name);

if (await replace_file(sdk_service_fname, sdk_service_dir))
    print(`✔ Removed ${sdk_service_dir}`);
print(`✔ Copied ${sdk_service_fname} to ${sdk_service_dir}`);

if (await replace_file(brd_api_fname, brd_api_dst_fname))
    print(`✔ Removed ${brd_api_dst_fname}`);
print(`✔ Copied ${brd_api_fname} to ${brd_api_dst_fname}`);

const sdk_package_fname = path.join(sdk_service_dir, 'package.json');
const sdk_services_fname = path.join(sdk_service_dir, 'services.json');

const sdk_package = read_json(sdk_package_fname);
const sdk_service_id = sdk_package.name
    .replace(/.+(\.brd_sdk)$/, appid+'$1');

set_json_props(sdk_package_fname, ['name'], sdk_service_id);
print(`✔ Processed ${sdk_package_fname}`);

set_json_props(sdk_services_fname, ['id', 'services.0.id', 'services.0.name'],
    sdk_service_id);
print(`✔ Processed ${sdk_services_fname}`);


if (!opt.interactive)
    return;

if (!prev_config_fname)
{
    const next_config = {appdir, sdk_ver, sdk_url: sdk_url_mask};
    for (const [prop, val] of [
        ['js_dir', js_dir],
        ['sdk_service_dir', sdk_service_dir],
    ])
    {
        const value = val.replace(appdir, '').slice(1)||'';
        if (value)
            next_config[prop] = value;
    }
    print(`Generated config:
${JSON.stringify(next_config, null, 2)}
    `);
    const next_config_fname = get_config_fname(appdir);
    write_json(next_config_fname, next_config);
    print(`✔ Saved config into ${next_config_fname}`);
}

print(`
Thank you for using our products!
To commit your changes, run:

cd ${appdir} && \\
git add ${path.basename(sdk_service_dir)} && \\
git add ${path.join(js_name, brd_api_name)} && \\
git commit -m 'update brd_sdk to v${sdk_ver}'

To start over, run

cd ${appdir} && git checkout . && cd -

`);

if (opt.interactive)
    process_close();

};

module.exports = {get_config_fname, process_webos};