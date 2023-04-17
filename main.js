let APP_ID = 'f2d6b675309c4f1ebc8959a9c5bdd285'

let token = null
let uid = String(Math.floor(Math.random() * 10000))

let client
let channel

let queryString = window.location.search
let urlParams = new URLSearchParams(queryString)
let roomId = urlParams.get('room')

if (!roomId) {
    window.location = 'lobby.html'
}

let localStream
let remoteStream
let peerConnection

const servers = {
    iceServers: [
        {
            urls: ['stun:stun1.l.google.com:19302', 'stun:stun2.l.google.com:19302']
        }
    ]
}
let init = async () => {
    client = await AgoraRTM.createInstance(APP_ID)
    await client.login({ uid, token })

    channel = client.createChannel(roomId)
    await channel.join()
    channel.on('MemberJoined', handleUserJoined)
    channel.on('MemberLeft', handleUserLeft)

    client.on('MessageFromPeer', handleMessageFromPeer)

    localStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: true })
    document.getElementById('user-1').srcObject = localStream
}

let handleUserLeft = async (memberId) => {
    document.getElementById('user-2').style.display = 'none'
}

let handleMessageFromPeer = async (message, memberId) => {
    message = JSON.parse(message.text)

    if (message.type === 'offer') {
        createAnswer(memberId, message.offer)
    }

    if (message.type === 'answer') {
        addAnswer(message.answer)
    }

    if (message.type === 'candidate') {
        if (peerConnection) {
            peerConnection.addIceCandidate(message.candidate)
        }
    }

}

let handleUserJoined = async (memberId) => {
    console.log(`User ${memberId} has joined the channel`);
    createOffer(memberId)
}

let createPeerConnection = async (memberId) => {
    peerConnection = new RTCPeerConnection(servers)

    remoteStream = new MediaStream()
    document.getElementById('user-2').srcObject = remoteStream
    document.getElementById('user-2').style.display = 'block'

    document.getElementById('user-1').classList.add('smallFrame')

    if (!localStream) {
        localStream = await navigator.mediaDevices.getUserMedia({ audio: false, video: true })
        document.getElementById('user-1').srcObject = localStream
    }

    localStream.getTracks().forEach((track) => {
        peerConnection.addTrack(track, localStream)
    });

    peerConnection.ontrack = (event) => {
        event.streams[0].getTracks().forEach((track) => {
            remoteStream.addTrack(track)
        })
    }

    peerConnection.onicecandidate = async (event) => {
        if (event.candidate) {
            client.sendMessageToPeer({
                text: JSON.stringify({
                    'type': "candidate", 'candidate': event.candidate
                })
            }, memberId)
        }
    }
}

let createOffer = async (memberId) => {
    await createPeerConnection(memberId)

    let offer = await peerConnection.createOffer()
    await peerConnection.setLocalDescription(offer)

    client.sendMessageToPeer({
        text: JSON.stringify({
            'type': "offer", 'offer': offer
        })
    }, memberId)
}

let createAnswer = async (memberId, offer) => {
    await createPeerConnection(memberId)
    await peerConnection.setRemoteDescription(offer)
    let answer = await peerConnection.createAnswer()
    await peerConnection.setLocalDescription(answer)
    client.sendMessageToPeer({
        text: JSON.stringify({
            'type': "answer", 'answer': answer
        })
    }, memberId)
}

let addAnswer = async (answer) => {
    if (!peerConnection.currentRemoteDescription) {
        peerConnection.setRemoteDescription(answer)
    }
}

let toggleCamera = async () => {
    let videoTrack = localStream.getTracks().find(track => track.kind === 'video')

    if (videoTrack.enabled) {
        videoTrack.enabled = false
        document.getElementById('camera-btn').style.backgroundColor = 'rgb(255, 80, 80)'
    } else {
        videoTrack.enabled = true
        document.getElementById('camera-btn').style.backgroundColor = 'rgb(179, 102, 249, .9)'
    }
}

let toggleMicrophone = async () => {
    let audioTrack = localStream.getTracks().find(track => track.kind === 'audio')

    if (audioTrack.enabled) {
        audioTrack.enabled = false
        document.getElementById('mic-btn').style.backgroundColor = 'rgb(255, 80, 80)'
    } else {
        audioTrack.enabled = true
        document.getElementById('mic-btn').style.backgroundColor = 'rgb(179, 102, 249, .9)'
    }
}

let leaveChannel = async () => {
    await channel.leave()
    await client.logout()
}

document.getElementById('mic-btn').addEventListener('click', toggleMicrophone)
document.getElementById('camera-btn').addEventListener('click', toggleCamera)
window.addEventListener('beforeunload', leaveChannel)

init()