/**
 * BGMJS (c) 2023 Tony Yip
 */
interface BGMTrack {
	index: number;
	src: string;
	name: string;
	artist?: string;
	album?: string;
}
interface BGMConfig {
	indexPath: string;
	color?: string;
	autoplay?: boolean;
	volumeSteps?:number;
}
class BGMPlayer {
	protected DEFAULT_VOLUME_LEVEL = 0.5;
	protected VOLUME_CONTROL_STEPS = 35;

	protected tracklistSource: string;

	protected currentTrack: HTMLAudioElement;
	protected trackList: Array<BGMTrack>;

	protected trackNameDisplay: HTMLSpanElement;
	protected muteControl: HTMLSpanElement;

	protected volumeControl: HTMLProgressElement;
	protected volumeControlSteps: number;
	protected volumeControlFaderHandle: number;

	protected volumeLevel = this.DEFAULT_VOLUME_LEVEL;
	protected muted: boolean = true;
	protected autoplay: boolean;

	protected uiColor: string;

	constructor(config: BGMConfig) {
		this.tracklistSource = config.indexPath;
		this.autoplay = config.autoplay ?? false;
		this.uiColor = config.color;
		this.volumeControlSteps = config.volumeSteps ?? this.VOLUME_CONTROL_STEPS;
		this.initialize();

	}

	protected loadTrackList(callBack: (player: BGMPlayer) => void): void {
		console.info('Loading track list');
		fetch(this.tracklistSource, { cache: 'no-store' })
			.then(response => response.json())
			.then(data => {
				this.trackList = data;
			}).then(() => callBack(this))
			.catch(err => {
				console.error(err);
				this.handleFatalError();
			});
	}

	public setTrack(index: number): void {
		let track = this.trackList.find(t => t.index === index);
		if (!!track) {
			//unset the current track first
			if (this.currentTrack && !this.currentTrack.paused) {
				console.info('Current track not stooped, stopping');
				this.currentTrack.pause();
			}
			this.loadTrack(track.src, () => {
				this.playTrack();
				this.trackNameDisplay.style.display = 'initial';
				this.trackNameDisplay.innerText = track.name;
				this.currentTrack.oncanplay = undefined;//unset the event
			});
		} else {
			console.error(`Track ${index} not found in track list`);
			console.warn("Selected track cannot be played, moving on to next track");
			this.handleLoadTrackError();
		}
	}

	protected loadTrack(path: string, onLoad: (this: GlobalEventHandlers, ev: Event) => any): void {
		console.info('Loading track: ', path);
		this.currentTrack = new Audio(path);
		this.currentTrack.oncanplay = onLoad;
		this.currentTrack.onerror = () => {
			console.error('Cannot play selected track: ', this.currentTrack.error);
			console.warn("Selected track cannot be played, moving on to next track");
			this.handleLoadTrackError();

		};
		this.currentTrack.onended = () => {
			console.info("Picking next track");
			this.randomSetTrack();
		}
		this.currentTrack.load();
	}

	protected playTrack(): void {
		if (this.currentTrack) {
			if (this.currentTrack.paused) {
				this.currentTrack.volume = this.volumeLevel;
				this.currentTrack.muted = this.muted;
				const play = () => {
					this.currentTrack.play().then(() => {
						console.log('Begin playing selected track');
						if (navigator.mediaSession) {
							navigator.mediaSession.playbackState = 'playing';
						}
					}
					).catch(e => {
						console.error('Cannot play selected track: ', e);
					});
				}
				if (this.muted) {
					if (this.autoplay) {
						//autoplay requires user interaction to play, so trigger it on page click
						document.addEventListener('click', play, { once: true })
					} else {
						// do nothing, track will play when user manully unmute.
					}
				} else {
					play();
				}
			} else {
				console.log("Track already playing")
			}
		} else {
			console.warn('Track not set, will not play');
			this.handleFatalError();
		}
	}

	protected stopTrack(): void {
		if (!!this.currentTrack) {
			this.currentTrack.pause();
			if (navigator.mediaSession) {
				navigator.mediaSession.playbackState = 'paused';
			}
			console.info('Stopped playback');
		}
	}

	public toggleMute(state?: boolean): void {
		if (state !== undefined) {
			this.muted = state;
		} else {
			this.muted = !this.muted;
		}
		if (!!this.currentTrack) {
			this.currentTrack.muted = this.muted;
		}
		if (this.muted) {
			this.volumeLevel = 0;
			this.stopTrack()
			if (this.volumeControlFaderHandle !== null) {
				//handles the case when this is muted when adjusting volume
				clearTimeout(this.volumeControlFaderHandle);
				this.hideVolumeControl();
			}
		} else {
			this.volumeLevel = this.DEFAULT_VOLUME_LEVEL;
			this.playTrack()
		}
		this.updateMuteDisplay();
		this.updateVolumeControlDisplay();
	}

	protected updateMuteDisplay(): void {
		this.muteControl.innerHTML = this.muted ? 'music_off' : 'music_note'
	}

	protected showVolumeControl(): void {
		if (!this.muted) {
			this.updateVolumeControlDisplay();
			this.trackNameDisplay.style.display = 'none';
			this.volumeControl.style.display = 'initial';
			if (this.volumeControlFaderHandle !== null) {
				clearTimeout(this.volumeControlFaderHandle);
			}
			this.volumeControlFaderHandle = setTimeout(() => {
				this.hideVolumeControl();
				this.volumeControlFaderHandle = null;
			}, 4000);
		}
	}

	protected hideVolumeControl(): void {
		this.volumeControl.style.display = 'none';
		this.trackNameDisplay.style.display = 'initial';
	}

	public changeVolume(increase: boolean): void {
		let change = 100 / this.volumeControlSteps / 100;
		if (!increase) {
			change = 0 - change;
		}
		this.volumeLevel += change;
		this.volumeLevel = Math.max(Math.min(this.volumeLevel, 1), 0);
		if (!!this.currentTrack) {
			this.currentTrack.volume = this.volumeLevel;
		}
		this.updateVolumeControlDisplay();
	}

	protected updateVolumeControlDisplay(): void {
		this.volumeControl.value = this.volumeLevel * 100;
	}

	protected randomSetTrack(): void {
		this.setTrack(this.trackList[Math.floor(Math.random() * this.trackList.length)].index)
	}

	protected handleLoadTrackError(): void {
		this.randomSetTrack();
	}

	protected handleFatalError(): void {
		this.toggleMute(true)
		this.trackNameDisplay.style.display = 'none';
	}

	protected loadStyling(): void {
		const link: HTMLLinkElement = document.createElement("link");
		link.href = "bgm.css";
		link.type = "text/css";
		link.rel = "stylesheet";
		link.media = "screen,print";
		document.head.appendChild(link);
		const gFontlink: HTMLLinkElement = document.createElement("link");
		gFontlink.href = "https://fonts.googleapis.com/css2?family=Material+Symbols+Sharp";
		gFontlink.type = "text/css";
		gFontlink.rel = "stylesheet";
		gFontlink.media = "screen,print";
		document.head.appendChild(gFontlink);
	}

	protected initialize(): void {
		const element: HTMLDivElement = document.createElement('div');
		element.id = "bgm-player"
		element.innerHTML = '<span id="bgm-indicator" class="material-symbols-sharp">music_note</span><span id="bgm-track-name-display"></span><progress id="bgm-volume-control" max="100" min="0"></progress>'
		document.querySelector('body').appendChild(element)
		this.loadStyling()
		if (!!this.uiColor) {
			element.style.setProperty("--prim-color", this.uiColor);
		}
		this.trackNameDisplay = document.querySelector('#bgm-track-name-display');
		this.muteControl = document.querySelector('#bgm-indicator');
		this.volumeControl = document.querySelector('#bgm-volume-control');
		this.muteControl.addEventListener('click', () => this.toggleMute());
		this.trackNameDisplay.addEventListener('click', () => this.randomSetTrack());
		this.trackNameDisplay.addEventListener('wheel', (e: WheelEvent) => {
			e.preventDefault();
			e.stopPropagation();
			this.showVolumeControl();
		}, { passive: false });
		this.volumeControl.addEventListener('wheel', (e: WheelEvent) => {
			e.preventDefault();
			e.stopPropagation();
			this.showVolumeControl();
			this.changeVolume(e.deltaY < 0)
		}, { passive: false })
		this.updateMuteDisplay();
		this.loadTrackList((player: BGMPlayer) => {
			player.randomSetTrack();
		});
	}
}