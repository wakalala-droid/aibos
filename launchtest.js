const puppeteer = require('puppeteer-core');
(async () => {
  try {
    const b = await puppeteer.launch({
      executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
      headless: true,
      dumpio: true,
      pipe: false,
      userDataDir: 'C:/Users/User/AppData/Local/Temp/claude/edgepptr',
      args: ['--no-sandbox','--disable-gpu'],
    });
    console.log('LAUNCHED', (await b.version()));
    await b.close();
  } catch (e) { console.error('ERR', e.message); }
})();
