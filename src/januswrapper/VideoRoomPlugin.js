import store from '../plugins/vuex';

export class VideoRoomPlugin {

    constructor(opaqueId, bitrateCap = false, test = 'video') {
        this.bitrateCap = bitrateCap;
        this.test = test;
        this.pluginHandle = null;
        this.opaqueId = opaqueId;
        this.inThrottle = null;
        this.feeds = [];
        this.listeners = {
            'error': [],
            'localUserJoined': [],
            'userJoined': [],
            'userLeft': [],
            'userUpdated': [],
            'attach': [],
            'roomAvailable': [],
            'pluginAttached': [],
            'ownUserJoined': [],
            'attachSubscriberPlugin': [],
            'cleanupUser': [],
        };
        this.myId = null;
        this.myPrivateId = null;
        this.myRoom = null;
        this.myUsername = null;
        this.myStream = null;
    }

    attach() {
        return {
            plugin: 'janus.plugin.videoroom',
            opaqueId: this.opaqueId,
            success: (pluginHandle) => {
                this.onAttachSucces(pluginHandle);
            },
            error: this.onError,
            onmessage: async (msg, jsep) => {
                await this.onMessage(msg, jsep);
            },
            onlocalstream: (stream) => {
                this.onLocalStream(stream);
            },
            onremotestream: (stream) => {
            },
        };
    }

    determineSpeaker(stream, remoteFeed, id) {
        if (!window.audioContext) {
            var _AudioContext = window.AudioContext || window.webkitAudioContext;
            window.audioContext = new _AudioContext();
        }

        if (window.audioContext) {
            let analyser = window.audioContext.createAnalyser();
            let microphone = window.audioContext.createMediaStreamSource(stream);
            let javascriptNode = window.audioContext.createScriptProcessor(2048, 1, 1);

            analyser.smoothingTimeConstant = 0.8;
            analyser.fftSize = 1024;

            microphone.connect(analyser);
            analyser.connect(javascriptNode);
            javascriptNode.connect(window.audioContext.destination);
            javascriptNode.onaudioprocess = () => {
                const array = new Uint8Array(analyser.frequencyBinCount);
                analyser.getByteFrequencyData(array);
                let values = 0;

                const length = array.length;
                for (let i = 0; i < length; i++) {
                    values += array[i];
                }

                const average = values / length;
                if (
                    !store.getters.selectedUser ||
                    (store.getters.selectedUser && !store.getters.selectedUser.pinned && average > 20 && remoteFeed.rfdisplay !== store.getters.selectedUser.username)
                ) {
                    if (!this.inThrottle) {
                        this.inThrottle = true;
                        store.dispatch('selectUser', {
                            id: id,
                            username: remoteFeed.rfdisplay,
                            stream: stream,
                            pluginHandle: remoteFeed,
                            screenShareStream: null,
                            pinned: false,
                        });
                        setTimeout(() => (this.inThrottle = false), 1000);
                    }
                }
            };
        }
    }

    hashString(str) {
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            hash += Math.pow(str.charCodeAt(i) * 31, str.length - i);
            hash = hash & hash;
        }
        return hash;
    }

    detachFeed(detachRfid) {
        this.feeds = this.feeds.reduce((carry, feed) => {
            if (feed.rfid !== detachRfid) {
                carry.push(feed);
                return carry;
            }
            feed.detach();
            return carry;
        }, []);
    }

    addEventListener(eventMessage, event) {
        this.listeners[eventMessage].push(event);
    }

    emitEvent(eventMessage, msg) {
        const events = this.listeners[eventMessage];

        if (!events) {
            return;
        }

        for (const event of events) {
            event(msg);
        }
    }

    onAttachSucces(pluginHandle) {
        this.pluginHandle = pluginHandle;
        this.emitEvent('pluginAttached', pluginHandle);
    }

    onError(error) {
        this.emitEvent('error', error);
    }

    async onMessage(msg, jsep) {
        console.log({ msg, jsep });
        if (jsep) {
            this.pluginHandle.handleRemoteJsep({
                jsep: jsep,
                success: () => {
                },
            });
        }

        if (msg.videoroom === 'joined') {
            this.myPrivateId = msg.private_id;
            this.myId = msg.id;
            this.myRoom = msg.room;
            this.emitEvent('ownUserJoined', this.buildUser(this.generateDummyMediaStream(), this.myId, this.myUsername, {
                pluginHandle: this.pluginHandle,
            }));

            console.log({ test: this.test, msg });
            if (msg.publishers) {
                msg.publishers.forEach(element => {
                    this.emitEvent('attachSubscriberPlugin', this.attachSubscriber(element['id'], element['display'], element['audio_codec'], element['video_codec']));
                    this.emitEvent('userJoined', this.buildUser(this.generateDummyMediaStream(), element['id'], element['display']));
                });
            }
            if (msg.attendees) {
                msg.attendees.forEach(element => {
                    this.emitEvent('userJoined', this.buildUser(this.generateDummyMediaStream(), element['id'], element['display']));
                });
            }
            return;
        }

        if (msg.videoroom === 'event') {
            if (msg.publishers) {
                msg.publishers.forEach(element => {
                    this.emitEvent('attachSubscriberPlugin', this.attachSubscriber(element['id'], element['display'], element['audio_codec'], element['video_codec']));
                });
            }
            if (msg.leaving) {
                this.emitEvent('userLeft', this.buildUser(this.generateDummyMediaStream(), msg.leaving, 'left'));

            }
        }

        if (msg.joining) {
            this.emitEvent('userJoined', this.buildUser(this.generateDummyMediaStream(), msg.joining.id, msg.joining.display));

        }

    }

    generateDummyMediaStream(width = 640, height = 480) {
        let canvas = Object.assign(document.createElement('canvas'), { width, height });
        canvas.getContext('2d').fillRect(0, 0, width, height);

        let stream = canvas.captureStream();
        let emptyVideo = Object.assign(stream.getVideoTracks()[0], { enabled: false });
        emptyVideo.stop();
        emptyVideo.dispatchEvent(new Event('ended'));

        let ctx = new AudioContext(), oscillator = ctx.createOscillator();
        let dst = oscillator.connect(ctx.createMediaStreamDestination());

        oscillator.start();
        let emptyAudio = Object.assign(dst.stream.getAudioTracks()[0], { enabled: false });
        emptyAudio.stop();
        emptyAudio.dispatchEvent(new Event('ended'));

        return new MediaStream([emptyVideo, emptyAudio]);
    }

    async publishOwnFeed() {
        this.myStream = this.generateDummyMediaStream();

        this.pluginHandle.createOffer({
            stream: this.myStream,
            success: jsep => {
                const publish = { request: 'configure', audio: true, video: true };

                this.pluginHandle.send({
                    message: publish,
                    jsep: jsep,
                    success: () => {
                    },
                    error: () => {
                    },
                });
            },
            error: error => {
            },
        });
    }

    async publishTrack(track) {
        let peerConnection = this.pluginHandle.webrtcStuff.pc;
        if (!peerConnection) {
            await this.publishOwnFeed();
            peerConnection = this.pluginHandle.webrtcStuff.pc;
        }
        const senders = peerConnection.getSenders();

        const rtcpSender = senders.find(sender => sender.track.kind === track.kind);
        await rtcpSender.replaceTrack(track);

        const streamTrack = this.myStream.getTracks().find(t => t.kind === track.kind);
        streamTrack.stop();
        streamTrack.dispatchEvent(new Event('ended'));

        this.myStream = new MediaStream([track, this.myStream.getTracks().find(t => t.kind !== track.kind)]);
        this.emitEvent('ownUserJoined', this.buildUser(this.myStream, this.myId, this.myUsername, {
            peerConnection,
            pluginHandle: this.pluginHandle,
        }));
    }

    //  await this.publishTrack((await navigator.mediaDevices.getDisplayMedia()).getVideoTracks()[0]);

    onLocalStream(stream) {
        this.emitEvent('ownUserJoined', this.buildUser(stream, this.myId, this.myUsername));
    }

    buildUser(stream, id, username = this.myUsername, extra = {}) {
        return {
            id: id,
            uuid: username.slice(0, 36),
            username: username.slice(37),
            room: this.myRoom,
            stream: stream,
            cam: false,
            screen: false,
            extra,
        };
    }

    async createRoom(roomName) {
        return new Promise(((resolve, reject) => {
            this.pluginHandle.send({
                message: {
                    request: 'exists',
                    room: roomName,
                },
                success: (result) => {
                    if (result.exists) {
                        resolve(result);
                        return;
                    }


                    const message = {
                        request: 'create',
                        room: roomName,
                        permanent: false,
                        description: 'Super room!',
                        bitrate_cap: this.bitrateCap,
                        require_pvtid: true,
                        publishers: 16,
                        transport_wide_cc_ext: true,
                        fir_freq: 10,
                        is_private: true,
                        notify_joining: true,
                    };

                    if (this.bitrateCap) {
                        message.bitrate= 128000*2
                    }

                    this.pluginHandle.send({
                        message,
                        success: (result) => {
                            resolve(result);
                        },
                    });
                },
            });
        }));
    }

    async joinRoom(roomName, username) {
        this.myUsername = username;
        return new Promise((resolve, reject) => {
            this.pluginHandle.send({
                message: {
                    request: 'join',
                    room: roomName,
                    ptype: 'publisher',
                    display: username,
                },
                success: () => {
                    resolve();
                },
            });
        });
    }

    attachSubscriber(id, display, audio, video) {
        let pluginHandle = {};

        let room = this.myRoom;

        return {
            plugin: 'janus.plugin.videoroom',
            opaqueId: this.opaqueId,
            success: succesHandle => {
                pluginHandle = succesHandle;
                pluginHandle.simulcastStarted = false;

                const subscribe = {
                    request: 'join',
                    room: room,
                    ptype: 'subscriber',
                    feed: id,
                    private_id: this.myPrivateId,
                };

                pluginHandle.videoCodec = video;
                pluginHandle.send({
                    message: subscribe,
                    success: () => {
                    },
                });
            },
            error: error => {
            },
            onmessage: (msg, jsep) => {
                if (jsep !== undefined && jsep !== null) {
                    pluginHandle.createAnswer({
                        jsep: jsep,
                        stream: this.myStream,
                        success: jsep => {
                            const body = {
                                request: 'start',
                                room: room,
                            };

                            pluginHandle.send({
                                message: body,
                                jsep: jsep,
                                success: () => {
                                },
                            });
                        },
                        error: error => {
                        },
                    });
                }

                const event = msg['videoroom'];

                if (event) {
                    switch (event) {
                        case 'attached':
                            for (let i = 1; i < 16; i++) {
                                if (
                                    this.feeds[i] === undefined ||
                                    this.feeds[i] === null
                                ) {
                                    this.feeds[i] = pluginHandle;
                                    pluginHandle.rfindex = i;
                                    break;
                                }
                            }
                            pluginHandle.rfid = msg['id'];
                            pluginHandle.rfdisplay = msg['display'];
                            break;
                        case 'event':
                            if (msg['substream'] || msg['temporal']) {
                                if (!pluginHandle.simulcastStarted) {
                                    pluginHandle.simulcastStarted = true;
                                }
                            }
                            break;
                    }
                }


            },
            onremotestream: stream => {
                console.log({ stream, pluginHandle });
                this.emitEvent('userJoined', this.buildUser(stream, pluginHandle.rfid, pluginHandle.rfdisplay));
            },
            oncleanup: () => {
                console.log('[oncleanup]: ', pluginHandle.rfid);
                this.emitEvent('cleanupUser', this.buildUser(this.generateDummyMediaStream(), pluginHandle.rfid, pluginHandle.rfdisplay));
            },
        };
    }
}