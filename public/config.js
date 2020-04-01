export default {
    chatServer: 'https://ffc-api.staging.jimber.org/',
    appId: window.location.host,
    scope: JSON.stringify({ doubleName : true }),
    redirect_url: `/login?callback=true`,
    botFrontEnd: "https://ffc.staging.jimber.org/",
    botBackend: "https://ffc-api.staging.jimber.org/",
    debugJanus: false,
    janusServer: "https://janus.singlecore.be/janus"
}
