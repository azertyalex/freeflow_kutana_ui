import { JanusBuilder } from '../januswrapper/JanusBuilder';
import { VideoRoomPlugin } from '../januswrapper/VideoRoomPlugin';
import store from '../plugins/vuex';

export const initializeJanus = async (
    serverUrl,
    opaqueId,
    userName,
    roomName,
    initialStream
) => {
    const janusBuilder = new JanusBuilder(serverUrl, false);
    const videoRoomPlugin = new VideoRoomPlugin(opaqueId, true);
    let initialJoin = true;

    videoRoomPlugin.addEventListener('pluginAttached', async room => {
        const roomCreationResult = await videoRoomPlugin.createRoom(roomName);
        await videoRoomPlugin.joinRoom(roomCreationResult.room, userName);
    });

    const isVideoAuthorised = false;

    videoRoomPlugin.addEventListener('ownUserJoined', user => {
        console.log('ownUserJoined');

        if (initialJoin) {
            console.log('initialJoin');
            initialJoin = false;
            initialStream.getTracks().forEach(async track => {
                console.log('track', track)
                await videoRoomPlugin.publishTrack(track);
            });
        }

        const videoTrack = user.stream.getVideoTracks()[0];
        if (
            videoTrack &&
            !(
                videoTrack instanceof CanvasCaptureMediaStreamTrack &&
                videoTrack.canvas.dataset.dummy
            )
        ) {
            user.cam = store.getters.videoActive;
            videoTrack.onended = async event => {
                const localUser = store.getters.localUser;
                localUser.cam = false;
                store.commit('setLocalUser', localUser);
            };
        }

        const audioTrack = user.stream.getAudioTracks()[0];
        //@todo: improve this by not using label
        if (
            audioTrack &&
            audioTrack.label !== 'MediaStreamAudioDestinationNode'
        ) {
            user.mic = store.getters.audioActive;
            audioTrack.onended = async event => {
                const localUser = store.getters.localUser;
                localUser.mic = false;
                store.commit('setLocalUser', localUser);
            };
        }

        store.commit('setLocalUser', user);
    });

    videoRoomPlugin.addEventListener('userJoined', user => {
        console.log({ user });

        if (user === store.getters.localUser) {
            return;
        }
        const videoTrack = user?.stream?.getVideoTracks()[0];
        if (videoTrack && videoTrack.readyState === 'live') {
            user.cam = true;
        }
        store.commit('addRemoteUser', user);
    });

    videoRoomPlugin.addEventListener('userLeft', user => {
        store.commit('deleteRemoteUser', user);
    });
    videoRoomPlugin.addEventListener('cleanupUser', async user => {
        if (await store.dispatch('findUserById', user.id)) {
            store.commit('addRemoteUser', user);
            return;
        }
        store.commit('deleteRemoteUser', user);
    });

    // SCREENSHARE
    const screenShareRoomPlugin = new VideoRoomPlugin(
        opaqueId + '-screenshare',
        false,
        'screen'
    );

    screenShareRoomPlugin.addEventListener('pluginAttached', async room => {
        // this is a random constant string
        const roomPadding = 13516416;
        const roomCreationResult = await screenShareRoomPlugin.createRoom(
            roomName + roomPadding
        );
        await screenShareRoomPlugin.joinRoom(roomCreationResult.room, userName);
    });

    screenShareRoomPlugin.addEventListener('ownUserJoined', screenUser => {
        const videoTrack = screenUser.stream.getVideoTracks()[0];

        screenUser.stream.onended = () => {
            videoTrack.dispatchEvent(new Event('ended'));
            screenUser.stream.dispatchEvent(new Event('ended'));

            const localScreenUser = store.getters.localScreenUser;
            localScreenUser.screen = false;
            store.commit('setLocalScreenUser', localScreenUser);
        };

        store.commit('setLocalScreenUser', screenUser);
    });

    screenShareRoomPlugin.addEventListener('userJoined', screenUser => {
        if (screenUser === store.getters.localScreenUser) {
            return;
        }
        const videoTrack = screenUser.stream.getVideoTracks()[0];
        screenUser.stream.onended = () => {
            videoTrack.dispatchEvent(new Event('ended'));
            screenUser.stream.dispatchEvent(new Event('ended'));
            const newScreenUser = store.dispatch(
                'findScreenUserById',
                screenUser.id
            );
            newScreenUser.screen = false;
            store.commit('addRemoteScreenUser', newScreenUser);
        };

        if (videoTrack && videoTrack.readyState === 'live') {
            screenUser.screen = true;
        }
        store.commit('addRemoteScreenUser', screenUser);
    });

    screenShareRoomPlugin.addEventListener('userLeft', screenUser => {
        store.commit('deleteRemoteScreenUser', screenUser);
    });
    screenShareRoomPlugin.addEventListener('cleanupUser', async screenUser => {
        if (await store.dispatch('findScreenUserById', screenUser.id)) {
            store.commit('addRemoteScreenUser', screenUser);
            return;
        }
        store.commit('deleteRemoteScreenUser', screenUser);
    });

    const janus = await janusBuilder
        .addPlugin(videoRoomPlugin)
        .addPlugin(screenShareRoomPlugin)
        .build();

    // @todo: remove this, is used in muiltiple places tho
    window.janusshizzle = { screenShareRoomPlugin, videoRoomPlugin };

    return {
        startScreenShare: async () => {
            const stream = await navigator.mediaDevices.getDisplayMedia();
            const videoTrack = stream.getVideoTracks()[0];
            await screenShareRoomPlugin.publishTrack(videoTrack);
            const localScreenUser = store.getters.localScreenUser;
            stream.oninactive = () => {
                const localScreenUser = store.getters.localScreenUser;
                localScreenUser.screen = false;
                store.commit('setLocalScreenUser', localScreenUser);
                screenShareRoomPlugin.pluginHandle.hangup();
            };
            localScreenUser.screen = true;
            store.commit('setLocalScreenUser', localScreenUser);
        },
        stopScreenShare: async () => {
            screenShareRoomPlugin?.myStream?.getTracks().forEach(t => {
                t.stop();
            });
            const localScreenUser = store.getters.localScreenUser;
            localScreenUser.screen = false;
            store.commit('setLocalScreenUser', localScreenUser);
            screenShareRoomPlugin.pluginHandle.hangup();
        },
        startCamera: async () => {
            const stream = await store.dispatch('getVideoStream');
            // this.isVideoAuthorised = true
            await videoRoomPlugin.publishTrack(stream.getVideoTracks()[0]);
        },
        publishTrack: async (track, video, audio) => {
            await videoRoomPlugin.publishTrack(track, video, audio);
        },
        stopVideoTrack: () => {
            videoRoomPlugin.myStream.getVideoTracks()[0].stop();
            videoRoomPlugin.myStream
                .getVideoTracks()[0]
                .dispatchEvent(new Event('ended'));
        },
        stopAudioTrack: () => {
            videoRoomPlugin.myStream.getAudioTracks()[0].stop();
            videoRoomPlugin.myStream
                .getAudioTracks()[0]
                .dispatchEvent(new Event('ended'));
        },
        hangUp: () => {
            const presenter = store.getters.presenter;
            const localUser = store.getters.localUser;
            if (presenter && presenter.id === localUser.id) {
                store.dispatch('sendSignal', {
                    type: 'presenter_ended',
                    id: localUser.id
                });
            }
            videoRoomPlugin?.myStream?.getTracks().forEach(t => {
                t.stop();
            });
            screenShareRoomPlugin?.myStream?.getTracks().forEach(t => {
                t.stop();
            });
            videoRoomPlugin.pluginHandle.hangup();
            screenShareRoomPlugin.pluginHandle.hangup();
        },
    };
};
