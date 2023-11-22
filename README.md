# furncace-monitor

## How to install

1. Run `npm run build` to compile the typescript project
2. Create a copy of `furnace-monitor.example.service` as `furnace-monitor.service`, make the necessary changes to the file and copy it to `/etc/systemd/system`
3. Start the service with `systemctl start furnace-monitor`
4. Enable it to run on boot with `systemctl enable furnace-monitor`
