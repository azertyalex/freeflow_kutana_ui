export default {
    state: {
        localScreenUser: null,
        remoteScreenUsers: [],
        screenUserControl: null,
    },
    mutations: {
        setLocalScreenUser(state, screenUser) {
            state.localScreenUser = screenUser;
        },
        setScreenUserControl(state, screenUserControl) {
            state.screenUserControl = screenUserControl;
        },
        addRemoteScreenUser(state, screenUser) {

            if (state.localScreenUser && state.localScreenUser.id === screenUser.id) {
                return;
            }

            const screenUserIndex = state.remoteScreenUsers.findIndex(u => u.id === screenUser.id);

            if (screenUserIndex === -1) {
                state.remoteScreenUsers.push(screenUser);
                return;
            }

            state.remoteScreenUsers.splice(screenUserIndex, 1, screenUser);
        },
        deleteRemoteScreenUser(state, screenUser) {
            state.remoteScreenUsers = state.remoteScreenUsers.filter(u => u.id !== screenUser.id);
        }
    },
    actions: {
        findScreenUserById({getters}, id) {
            return getters.allScreenUsers.find(screenUser => screenUser.id === id);
        },
        findScreenUserByName({getters}, name) {
            return getters.allScreenUsers.find(screenUser => screenUser.name === name);
        }
    },
    getters: {
        localScreenUser: state => state.localScreenUser,
        remoteScreenUsers: state => state.remoteScreenUsers,
        allScreenUsers: state => [state.localScreenUser, ...state.remoteScreenUsers],
        screenUserControl: state => state.screenUserControl,
    }
};
