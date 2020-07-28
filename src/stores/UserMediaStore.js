import Vue from 'vue';

export default {
    state: {
        videoDeviceId: null,
        audioDeviceId: null,
        mediaDevices: [],
        mediaDeviceErrors: {}
    },
    mutations: {
        setVideoDeviceId(state, deviceId) {
            state.videoDeviceId = deviceId;
        },
        setAudioDeviceId(state, deviceId) {
            state.audioDeviceId = deviceId;
        },
        refreshMediaDevices(state, devices) {
            state.mediaDevices = devices;
        },
        setMediaDeviceError(state, error) {
            Vue.set(state.mediaDeviceErrors, error.type, error.message)
        }
    },
    actions: {
        async refreshMediaDevices({ commit }) {
            try {
                const devices = await navigator.mediaDevices.enumerateDevices();
                commit('refreshMediaDevices', devices);
            } catch (e) {
                commit('setMediaDeviceError', e);
            }
        },
        updateVideoDevice({ commit, getters }, deviceId) {
            if (deviceId || (!deviceId && getters.videoDeviceId)) {
                commit('setVideoDeviceId', deviceId);
            }
        },
        updateAudioDevice({ commit, getters }, deviceId) {
            if (deviceId || (!deviceId && getters.audioDeviceId)) {
                commit('setAudioDeviceId', deviceId);
            }
        },
        async getVideoStream({ commit, getters, dispatch }, deviceId = null) {
            if (deviceId || (!deviceId && getters.videoDeviceId)) {
                const stream = await navigator.mediaDevices.getUserMedia({
                    video: {
                        deviceId: deviceId ? deviceId : getters.videoDeviceId,
                    },
                });
                commit('setVideoDeviceId', deviceId);
                return stream;
            }
            try {
                const stream = await navigator.mediaDevices.getUserMedia({
                    video: true,
                });
                const newDeviceId = dispatch('findDeviceId', {
                    kind: 'videoinput',
                    label: stream.getVideoTracks()[0].label,
                });

                commit('setVideoDeviceId', newDeviceId);
                dispatch('refreshMediaDevices');
                return stream;
            } catch (e) {
                commit('setMediaDeviceError', { type: 'video', message: e.message});
            }
        },
        async getAudioStream({ commit, getters, dispatch }, deviceId = null) {
            if (deviceId || (!deviceId && getters.audioDeviceId)) {
                const stream = await navigator.mediaDevices.getUserMedia({
                    audio: {
                        deviceId: deviceId ? deviceId : getters.audioDeviceId,
                    },
                });
                commit('setAudioDeviceId', deviceId);
                return stream;
            }
            try {
                const stream = await navigator.mediaDevices.getUserMedia({
                    audio: true,
                });
                const newDeviceId = dispatch('findDeviceId', {
                    kind: 'audioinput',
                    label: stream.getAudioTracks()[0].label,
                });

                commit('setAudioDeviceId', newDeviceId);
                dispatch('refreshMediaDevices');

                return stream;
            } catch (e) {
                commit('setMediaDeviceError', { type: 'audio', message: e.message});
            }
        },
        async findDeviceId(_, { kind, label }) {
            const devices = await navigator.mediaDevices.enumerateDevices();
            const kindDevices = devices.filter(d => d.kind === kind);
            return kindDevices.find(d => d.label === label)?.deviceId;
        },
    },
    getters: {
        videoDeviceId: state => state.videoDeviceId,
        audioDeviceId: state => state.audioDeviceId,
        mediaDevices: state => state.mediaDevices,
        mediaDeviceErrors: state => state.mediaDeviceErrors,
    },
};
