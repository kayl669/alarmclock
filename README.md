# Alarm Clock

## TODO

- [ ] Read time twice daily from Google calendar

## Requirements

### Node

### Yarn

### Amixer

`sudo apt-get install alsa-utils`

### Sound dev packages

`sudo apt-get install libasound2-dev`

See [https://www.npmjs.com/package/speaker]().

### Important System Requirements

##Disable GPIO interrupts
If running a newer Raspbian release, you will need to add the following line to /boot/config.txt and reboot:

`dtoverlay=gpio-no-irq`

Without this you may see crashes with newer kernels when trying to poll for pin changes.

Enable /dev/gpiomem access
By default the module will use /dev/gpiomem when using simple GPIO access. To access this device, your user will need to be a member of the gpio group, and you may need to configure udev with the following rule (as root):

$ cat >/etc/udev/rules.d/20-gpiomem.rules <<EOF
SUBSYSTEM=="bcm2835-gpiomem", KERNEL=="gpiomem", GROUP="gpio", MODE="0660"
EOF

See [https://www.npmjs.com/package/rpio]()

## References

- https://www.raspberrypi.org/forums/viewtopic.php?t=6056
