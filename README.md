# furncace-monitor

## How to install

1. Run `npm run build` to compile the typescript project
2. Create a copy of `config.example.json` as `config.json` and make the necessary adjustments
3. Create a copy of `furnace-monitor.example.service` as `furnace-monitor.service`, make the necessary changes to the file and copy it to `/etc/systemd/system`
4. Start the service with `systemctl start furnace-monitor`
5. Enable it to run on boot with `systemctl enable furnace-monitor`
