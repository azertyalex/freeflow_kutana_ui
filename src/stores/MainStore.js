export default {
    state: {
        viewStyle: localStorage.getItem('view-style') || 'Default',
        snackbarMessage: '',
        alertUser: null,
        localStream: null,
    },
    mutations: {
        setSnackbarMessage(state, message) {
            state.snackbarMessage = message
        },
        alertUser(state) {
            state.alertUser = Math.random()
        },
        changeViewStyle(state, style) {
            state.viewStyle = style;
            localStorage.setItem('view-style', style);
        },
        setLocalStream(state, stream) {
            state.localStream = stream;
        }
    },
    actions: {
        setSnackbarMessage(context, message) {
            context.commit('setSnackbarMessage', message)
        },
        changeViewStyle(context, style) {
            console.log(style)
            context.commit('changeViewStyle', style);
        }
    },
    getters: {
        isGridView: state => state.viewStyle.toString() === 'Grid',
        snackbarMessage: state => state.snackbarMessage,
        alertUser: state => state.alertUser,
        localStream: state => state.localStream,
    },
}
