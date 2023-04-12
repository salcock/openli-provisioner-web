#!/bin/bash

SPACE=/usr/local/src/openli-provisioner-web

rm /etc/httpd/conf.d/openli-provisioner-web.conf

echo "Trying to stop services -- may generate error messages if running"
echo "in a container..."
systemctl reload apache2
systemctl stop openli-provisioner-web
systemctl disable openli-provisioner-web
systemctl daemon-reload

userdel openli-provisioner-web

/usr/libexec/redis-shutdown

echo "Removing react app from ${SPACE}..."
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"

nvm use 14
if [ -d ${SPACE}/node_modules/\@openli/openli-provisioner-web ]; then
    cd ${SPACE}/node_modules/\@openli/openli-provisioner-web
    make prefix=/usr/local uninstall
fi

if [ -d ${SPACE} ]; then
    rm -r ${SPACE}
fi

rm -rf /etc/openli-provisioner-web
rm /etc/systemd/system/openli-provisioner-web.service

echo
echo "OpenLI provisioner web has been uninstalled, but we've left nvm"
echo "and nodejs on your system in case something else is using them."
echo
echo "If you don't need them anymore and want to clean them up, please"
echo "run the following: "
echo "    nvm deactivate; nvm unload; sed -i '/NVM_DIR/d' ${HOME}/.bashrc"
echo