#!/bin/bash
set -e

mkdir -p /tmp/build

curl --list-only ftp://195.255.176.166/karttainfopoiminta/ --user ${USERNAME}:${PASSWORD} > /tmp/listings.txt

grep -E '^.*\.zip$' /tmp/listings.txt > /tmp/listingRes.txt
mv /tmp/listingRes.txt /tmp/listings.txt
export LATEST_FILE=`tail -1 /tmp/listings.txt`

echo "Latest file is ${LATEST_FILE}"

if [ -f "/tmp/build/$LATEST_FILE" ]
then
    echo "Latest build was already found, won't run it again"
    echo "Exiting!" 1>&2
    exit 64
fi

rm -rf /tmp/build/*


curl ftp://195.255.176.166/karttainfopoiminta/${LATEST_FILE} --user ${USERNAME}:${PASSWORD} --output /tmp/build/${LATEST_FILE}

ln -s /tmp/build/${LATEST_FILE} /tmp/build/latest.zip
echo "Latest build can be accessed as /tmp/build/latest.zip"
