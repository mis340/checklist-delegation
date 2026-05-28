try {
  require('lightningcss-win32-x64-msvc');
  console.log('require OK');
} catch (e) {
  console.error('ERROR:', e && e.stack ? e.stack : e);
  process.exit(1);
}
