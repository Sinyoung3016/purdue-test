import React, {useEffect, useState} from 'react';
import {Text, View, Alert} from 'react-native';

import {BleManager} from 'react-native-ble-plx';
import RNSoundLevel from 'react-native-sound-level';
import SoundPlayer from 'react-native-sound-player';

import {encodeBleString, decodeBleString} from './base64';
import {
  isDrowsy,
  genRandSec,
  isResponseFast,
  isDrowsyToInit,
  isResponseFastToInit,
} from './server';

let service = null;
let bioChar = null;
let vibeChar = null;

let hr = '0';
let spo2 = '0';
let startTime = null;

let drowsyStatus = true;
let audioName = 'wakeup';
let gaming = false;

let ctr = 1;
const tentimes = 150;

const serverUrl = 'http://192.168.2.208:8080/api/v1/UXdKE72SZUOxvFinh9c0/rpc';
const serverInitUrl =
  'http://192.168.2.208:8080/api/v1/UXdKE72SZUOxvFinh9c0/telemetry';

const manager = new BleManager();

export default function App() {
  const [ready, setReady] = useState(false);
  const [reload, setReload] = useState(false);

  function game(vibeChar) {
    let twomins = 0;
    if (drowsyStatus && !gaming) {
      gaming = true;
      console.log('====> GAME START');

      //sleep for random sec
      genRandSec(serverUrl).then(async response => {
        sleepSec = response.data;
        console.log('> 1. GAME : Sleep Sec :', sleepSec);
        await new Promise(r => setTimeout(r, sleepSec * 1000));
      });

      //start -> measure voice level
      RNSoundLevel.start().then(async () => {
        await vibeChar.writeWithResponse(encodeBleString('1'));
        startTime = new Date();
        console.log('> 2. GAME : Viberation');
      });

      //detect over val 4000 -> stop
      RNSoundLevel.onNewFrame = async data => {
        if (twomins++ == 8) {
          //over 2 secs -> timeout
          console.log('> 3. GAME : Response Time : Timeout');
          await new Promise(r => setTimeout(r, 100)).then(async () => {
            RNSoundLevel.stop();
            gaming = false;
          });
        }
        if (data.rawValue >= 4000) {
          //detected
          const duringTime = new Date() - startTime;
          console.log('> 3. GAME : Response Time :', duringTime);
          await new Promise(r => setTimeout(r, 100)).then(async () => {
            RNSoundLevel.stop();
            gaming = false;
          });

          //play sound result
          isResponseFast(serverUrl, hr, spo2, duringTime).then(response => {
            drowsyStatus = false;
            audioName = response.data;
            SoundPlayer.playSoundFile(audioName, 'mp3');
          });
        }
      };
    }
  }

  async function initGame(vibeChar) {
    let twomins = 0;

    //sleep for random sec
    genRandSec(serverUrl).then(async response => {
      sleepSec = response.data;
      console.log('> 1. GAME : Sleep Sec :', sleepSec);
      await new Promise(r => setTimeout(r, sleepSec * 1000));
    });

    //start -> measure voice level
    RNSoundLevel.start().then(async () => {
      await vibeChar.writeWithResponse(encodeBleString('1'));
      startTime = new Date();
      console.log('> 2. GAME : Viberation');
      ctr++;
    });

    //detect over val 4000 -> stop
    RNSoundLevel.onNewFrame = async data => {
      if (twomins++ == 8) {
        //over 2 secs -> timeout
        console.log('> 3. GAME : Response Time : Timeout');
        await new Promise(r => setTimeout(r, 100)).then(async () => {
          RNSoundLevel.stop();
        });
      }
      if (data.rawValue >= 4000) {
        //detected
        const duringTime = new Date() - startTime;
        console.log('> 3. GAME : Response Time :', duringTime);
        await new Promise(r => setTimeout(r, 100)).then(async () => {
          RNSoundLevel.stop();
        });

        //send result to server
        isResponseFastToInit(serverInitUrl, hr, sp02, duringTime);
      }
    };
  }

  async function monitorBioData(bioChar) {
    console.log('======= Start Initialize Threshold : BIO =======');
    console.log('start time : ', new Date());

    bioChar.monitor((err, bio) => {
      if (err) {
        console.log('err', err);
      }

      const bioData = decodeBleString(bio.value).split(':');
      hr = bioData[0];
      spo2 = bioData[1];

      if (ctr < tentimes + 1) {
        //Init Bio Threshold
        isDrowsyToInit(serverInitUrl, hr, sp02).then(() => {
          console.log(ctr, 'SEND BIO DATA');
        });
        if (ctr == tentimes) {
          console.log('======= End Initialize Threshold : BIO =======');
          console.log('end time : ', new Date());
        }
        ctr++;
      } else {
        //Send Bio Data
        if (!drowsyStatus) {
          isDrowsy(serverUrl, hr, spo2).then(response => {
            drowsyStatus = response.data;
            console.log('> SEND BIO DATA');
          });
        }
      }
    });
  }

  useEffect(() => {
    Alert.alert(
      'Warning',
      'Turn on Bluetooth and GPS \nThen click the OK button below',
      [{text: 'OK', onPress: () => setReload(true)}],
    );
  }, []);

  useEffect(() => {
    if (!reload) return;

    console.log('BLE > start');
    const subscription = manager.onStateChange(state => {
      if (state === 'PoweredOn') {
        manager.startDeviceScan(null, null, async (error, device) => {
          if (error) {
            console.log('error', error);
            return;
          }
          //BLE connect
          if (device.name === 'Croffle') {
            console.log('BLE > detected');

            manager.stopDeviceScan();

            const connectedDevice = await device.connect();
            const allServicesAndCharacteristics =
              await connectedDevice.discoverAllServicesAndCharacteristics();
            service = (await allServicesAndCharacteristics.services())[2];

            const char = await service.characteristics();
            bioChar = char[0];
            vibeChar = char[1];

            setReady(true);
            await bioChar.read();

            //monitor BioChar to get bio data
            monitorBioData(bioChar);

            while (1) {
              await new Promise(r => setTimeout(r, 4000));

              if (ctr > tentimes) {
                //Init ResponseTime Threshold
                if (ctr === tentimes + 1)
                  console.log(
                    '======= Start Initialize Threshold : RES =======',
                  );
                await initGame(vibeChar);
                if (ctr === tentimes + 10)
                  console.log('======= End Initialize Threshold : RES =======');
              } else if (ctr === tentimes + 10) {
                //Game Start
                game(vibeChar);
              }
            }
          }
        });
        console.log('power on');
        subscription.remove();
      }
    }, true);
  }, [reload]);

  return (
    <View
      style={{
        marginTop: 300,
        marginLeft: 50,
        width: 300,
        height: 100,
        alignItems: 'center',
        justifyContent: 'center',
      }}>
      {reload ? (
        <Text style={{fontSize: 30}}>
          {ready ? 'Shout when it vibrates' : 'Connecting... \n Please Wait.'}
        </Text>
      ) : null}
    </View>
  );
}
