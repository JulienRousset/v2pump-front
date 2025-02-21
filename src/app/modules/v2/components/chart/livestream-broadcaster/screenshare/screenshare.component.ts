import { Component, ElementRef, Input, ViewChild } from '@angular/core';

@Component({
    selector: 'app-screen-share',
    template: `
        <video #videoElement 
               autoplay 
               playsinline
               muted
               class="w-full h-full object-cover">
        </video>
    `
})
export class ScreenShareComponent {
    @ViewChild('videoElement') videoElement!: ElementRef;
    @Input() streamId!: string;
    @Input() rtmpUrl!: string;

    private screenMediaRecorder: MediaRecorder | null = null;
    screenStream: MediaStream | null = null;
    private screenWsConnection: WebSocket | null = null;


    ngOnInit(){
        this.startScreenShare();
    }
    async startScreenShare() {
        try {
            await this.cleanup();
            await this.connectWebSocket();

            const screenStream = await navigator.mediaDevices.getDisplayMedia({
                video: {
                    width: { ideal: 1920 },
                    height: { ideal: 1080 },
                    frameRate: { ideal: 30 }
                }
            });

            const audioStream = await navigator.mediaDevices.getUserMedia({
                audio: {
                    echoCancellation: false,
                    noiseSuppression: false,
                    autoGainControl: false,
                    sampleRate: 44100,
                    channelCount: 2
                }
            });

            const combinedStream = new MediaStream();
            screenStream.getVideoTracks().forEach(track => combinedStream.addTrack(track));
            audioStream.getAudioTracks().forEach(track => combinedStream.addTrack(track));

            this.setupMediaRecorder(combinedStream);
            this.screenStream = combinedStream;
            this.videoElement.nativeElement.srcObject = screenStream;

            screenStream.getVideoTracks()[0].onended = async () => {
                this.cleanup();
            };

        } catch (error) {
            console.error('Erreur partage écran:', error);
            throw error;
        }
    }

    private async connectWebSocket() {
        try {
            const wsUrl = `ws://localhost:3002?streamId=${this.streamId}&rtmpUrl=${encodeURIComponent(this.rtmpUrl)}&mode=screen`;
            this.screenWsConnection = new WebSocket(wsUrl);

            this.screenWsConnection.onopen = () => console.log('WebSocket screen connecté');
            this.screenWsConnection.onerror = (error) => console.error('WebSocket error:', error);
            this.screenWsConnection.onclose = () => console.log('WebSocket fermé');

        } catch (error) {
            console.error('Erreur connexion WebSocket:', error);
            throw error;
        }
    }

    private setupMediaRecorder(stream: MediaStream) {
        this.screenMediaRecorder = new MediaRecorder(stream, {
            mimeType: 'video/webm;codecs=h264',
            videoBitsPerSecond: 3000000,
            audioBitsPerSecond: 128000
        });

        this.screenMediaRecorder.ondataavailable = (event) => {
            if (event.data.size > 0 && this.screenWsConnection?.readyState === WebSocket.OPEN) {
                this.screenWsConnection.send(event.data);
            }
        };

        this.screenMediaRecorder.start(250);
    }

    toggleAudio(enabled: boolean) {
        if (this.screenStream) {
            this.screenStream.getAudioTracks().forEach(track => {
                track.enabled = enabled;
            });
        }
    }

    async cleanup() {
        if (this.screenMediaRecorder) {
            this.screenMediaRecorder.stop();
            this.screenMediaRecorder = null;
        }
        if (this.screenStream) {
            this.screenStream.getTracks().forEach(track => track.stop());
            this.screenStream = null;
        }
        if (this.screenWsConnection) {
            this.screenWsConnection.close();
            this.screenWsConnection = null;
        }
        if (this.videoElement?.nativeElement) {
            this.videoElement.nativeElement.srcObject = null;
        }
    }

    ngOnDestroy() {
        this.cleanup();
    }
}
