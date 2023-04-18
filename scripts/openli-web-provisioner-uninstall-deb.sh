#!/bin/bash

SPACE=/usr/local/src/openli-provisioner-web

if [ -d ${SPACE} ]; then
    rm -r ${SPACE}
fi

deluser openli-provisioner-web
rm -rf /usr/local/lib/openli-provisioner-web

echo
echo "OpenLI provisioner web has been uninstalled, but we've left nvm"
echo "and nodejs on your system in case something else is using them."
echo
echo "If you don't need them anymore and want to clean them up, please"
echo "run the following: "
echo "    nvm deactivate; nvm unload; sed -i '/NVM_DIR/d' ${HOME}/.bashrc"
echo
