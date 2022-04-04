module.exports = {
  apps: [{
    name: 'xummpush',
    script: 'index.js',
    watch: false,
    instances: 1,
    exec_mode: 'cluster',
    ignore_watch: ["node_modules", "db", ".git"],
    env: {}
  }]
}
