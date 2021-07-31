import { useState, useEffect, useRef } from 'react';
import io, { Socket } from 'socket.io-client';
import styled from 'styled-components';

export default function App() {
  const socket = useRef<Socket | any>(null);
  const myPeer = useRef(new RTCPeerConnection(PEER_CONFIG));
  const remoteStream = useRef(new MediaStream());

  const myVideo = useRef<HTMLVideoElement>(null);
  const remoteVideo = useRef<HTMLVideoElement>(null);
  const [myStream, setMyStream] = useState({});
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    (async () => {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: true,
      });
      setMyStream(stream);
      if (myVideo.current) myVideo.current.srcObject = stream;
      stream.getTracks().forEach((track) => {
        myPeer.current.addTrack(track);
      });
    })();
  }, []);

  useEffect(() => {
    myPeer.current.addEventListener('track', async ({ track }) => {
      remoteStream.current.addTrack(track);
    });

    myPeer.current.addEventListener('connectionstatechange', () => {
      if (myPeer.current.connectionState === 'connected') {
        setIsConnected(true);
        if (remoteVideo.current) remoteVideo.current.srcObject = remoteStream.current;

        console.log('Peer connected!!');
      }
    });
  }, []);

  const [myId, setMyId] = useState<string>('');
  const [users, setUsers] = useState<any[] | null>(null);
  const [offer, setOffer] = useState<any>(null);
  const [caller, setCaller] = useState<string>('');
  const [isCalling, setIsCalling] = useState<boolean>(false);

  useEffect(() => {
    socket.current = io('http://localhost:8000');
    socket.current.on('setMyId', (myId: string) => setMyId(myId));
    socket.current.on('users', (users: any[]) => setUsers(users));

    socket.current.on('sendOfferToCallee', async ({ caller, offer }: { [key: string]: any }) => {
      if (offer) {
        setOffer(offer);
        setCaller(caller);
        setIsCalling(true);
      }
    });

    socket.current.on('sendAnswerToCaller', async ({ answer }: { [key: string]: any }) => {
      if (answer) {
        await myPeer.current.setRemoteDescription(new RTCSessionDescription(answer));
      }
    });

    socket.current.on('sendCandidateToTarget', async ({ candidate }: { [key: string]: any }) => {
      if (candidate) {
        try {
          await myPeer.current.addIceCandidate(candidate);
        } catch (e) {}
      }
    });
  }, []);

  async function onClickConnectRequest(callee: string) {
    const offer = await myPeer.current.createOffer();
    await myPeer.current.setLocalDescription(offer);
    socket.current.emit('offer', { callee, offer });

    myPeer.current.addEventListener('icecandidate', iceCandidateHandler.bind(null, callee));
  }

  async function onClickAccept() {
    myPeer.current.setRemoteDescription(new RTCSessionDescription(offer));
    const answer = await myPeer.current.createAnswer();
    await myPeer.current.setLocalDescription(answer);
    socket.current.emit('answer', { caller, answer });
    setIsCalling(false);

    myPeer.current.addEventListener('icecandidate', iceCandidateHandler.bind(null, caller));
  }

  function iceCandidateHandler(target: string, { candidate }: { [key: string]: any }) {
    if (candidate) {
      socket.current.emit('new-ice-candidate', { target, candidate });
    }
  }

  return (
    <div>
      <p>ID: {myId}</p>
      {myStream && <Video ref={myVideo} muted autoPlay playsInline controls={false} />}
      {isConnected && <Video ref={remoteVideo} autoPlay playsInline controls={false} />}
      {users &&
        users.map((callee: string) => {
          return (
            callee !== myId && (
              <button type="button" key={callee} onClick={() => onClickConnectRequest(callee)}>
                {callee}
              </button>
            )
          );
        })}
      {isCalling && (
        <div>
          <p>{caller} is calling you</p>
          <button type="button" onClick={onClickAccept}>
            Accept
          </button>
        </div>
      )}
    </div>
  );
}

const PEER_CONFIG = {
  iceServers: [{ urls: 'stun:stun.l.google.com:19302' }],
};

const Video = styled.video`
  width: 300px;
  height: 200px;
  border: 1px solid red;
`;
