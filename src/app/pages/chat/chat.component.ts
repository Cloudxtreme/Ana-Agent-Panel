import {
	Component,
	OnInit,
	trigger,
	state,
	style,
	AfterViewChecked,
	transition,
	animate,
	ElementRef,
	HostListener,
	HostBinding,
	ViewChild,
	Input,
	TemplateRef,
	NgZone, DoCheck
} from "@angular/core";
import { Inject } from "@angular/core"
import { DOCUMENT } from "@angular/platform-browser"
import { StompService, StompConfig, ChatsResponse } from "../../shared/services/config/stomp.service"
import { GlobalState } from "../../app.state";
import { ConfigService, UserProfile } from "../../shared/services/config/config.service";
import { ChatCustomerInfo } from '../../shared/services/data/data.service';
import { MdSidenav } from "@angular/material";
import { Observable } from "rxjs";
import { DataService } from "../../shared/services/data/data.service";
import { uuid } from "../../shared/util/uuid";
import { NgbModal, ModalDismissReasons } from "@ng-bootstrap/ng-bootstrap";
import { timestamp } from "rxjs/operator/timestamp";
import { currentId } from "async_hooks";
import { Router } from "@angular/router";

@Component({
	selector: ".content_inner_wrapper",
	templateUrl: "./chat.component.html",
	styleUrls: ["./chat.component.scss"]
})

export class ChatComponent implements OnInit {
	@ViewChild("leftSidenav2") leftSidenav2: MdSidenav;
	@ViewChild("chatProfile") chatProfile: TemplateRef<any>;
	navMode = "side";
	@Input() chatId;
	chat: any;
	chatThread: any[] = [];
	recipientMedium: number
	threadId: any;
	threads: any;
	messages: any;
	term: any;
	isFocused: any;
	activeThread: any;
	activeProfile: any;
	userEmail: any;
	public newMessage: string;
	value: boolean
	closeResult: string;

	timestamp: any;
	activeSearch: boolean = false
	textArea: boolean = false;
	chatData = {
		content: [
			{
				customerId: "",
				businessId: ""
			}
		]
	} as ChatsResponse;
	tempData = {};
	chatThreads: {
		[custId: string]: any[]
	} = {};

	selectedCustomer: ChatCustomerInfo;
	customersList: ChatCustomerInfo[];

	statusText: any
	lastTimeStamp: string;
	public navIsFixed: boolean = false;
	public scrollbarOptions = { axis: "yx", theme: "minimal-dark" };

	@ViewChild("scrollMe") private myScrollContainer: ElementRef;

	constructor(
		private state: GlobalState,
		public configService: ConfigService,
		private elementRef: ElementRef,
		private dataService: DataService,
		private modalService: NgbModal,
		private stompService: StompService,
		private router: Router,
		@Inject(DOCUMENT) private _doc: Document
	) {
		this.stompService.handleMessageReceived = (msg) => {
			if (!this.chatThreads[msg.meta.sender.id])
				this.chatThreads[msg.meta.sender.id] = [];
			this.chatThreads[msg.meta.sender.id].push(msg.data);
		};
	}

	static uuidv4() {
		return (<any>[1e7] + -1e3 + -4e3 + -8e3 + -1e11).toString().replace(/[018]/g,
			c => (<any>c ^ crypto.getRandomValues(new Uint8Array(1))[0] & 15 >> <any>c / 4).toString(16)
		)
	}

	onAgentSelected(agent: ChatCustomerInfo) {
		this.selectedCustomer = agent;

		if (!this.chatThreads[agent.customerId]) {
			this.dataService.getHistory(agent.customerId, agent.businessId, 5, 0).subscribe(resData => {
				try {
					this.chatThreads[agent.customerId] = resData.content.filter(x => (x.data.type == 0) || (x.data.type == 2 && x.data.content.input && x.data.content.input.val));//Filtering only text inputs for now.
				}
				catch (e) {
					console.log(e);
					debugger;
				}
			});
		}
	}

	ngOnInit() {
		if (window.innerWidth < 992) {
			this.navMode = "over";
			this.leftSidenav2.opened = false;
		}
		if (window.innerWidth > 992) {
			this.navMode = "side";
			this.leftSidenav2.open();
		}
		if (!this.configService.profile) {
			this.router.navigateByUrl('/');
			return;
		}
		this.dataService.getChatDetails().subscribe((resData) => {
			if (resData.error) {
				alert(resData.error.message);
			} else {
				this.customersList = resData.data.content;
				this.stompService.handleConnect = () => {
					this.stompService.agentSubscriptions(this.customersList);
				};
				this.stompService.connect({
					debug: true,
					endpoint: this.configService.app.webSocketEndPoint
				});
			}
		});
	}

	scrollToBottom(): void {
		try {
			this.myScrollContainer.nativeElement.scrollTop = this.myScrollContainer.nativeElement.scrollHeight;
		} catch (err) { }
	}

	onScroll(event: UIEvent) {
		if (this.myScrollContainer.nativeElement.scrollTop == 0) {
			//this.timestamp = this.historyData.content[this.historyData.content.length - 1].meta.timestamp;
			//this._DataService.getHistory(this.customerId, this.businessId, 5, 0, this.timestamp).subscribe(resData => {
			//    //console.log(resData.content)
			//    resData.content.foreach(x => {
			//        this.chatThreads[this.customerId].push(x)
			//    })
			//    this.historyData.content = this.chatThreads[this.customerId];
			//    // for (let i = 0; i < resData.content.length; i++) {
			//    // 	this.chatThreads[this.customerId].push(resData);
			//    // 	this.historyData.content.push(resData.content[i]);
			//    // }
			//    //	console.log(this.historyData.content)
			//    //	console.log(JSON.stringify(this.historyData))
			//})
		}
	}

	isMe(senderType) {
		if (senderType != 0) {
			return true;
		} else {
			return false;
		}
	}
	isYou(senderType) {
		if (senderType != 0) {
			return false;
		} else {
			return true;
		}
	}
	getMsgImage(senderType) {
		if (senderType == 0) {
			return "/assets/img/profiles/avatar.png"
		}
		else {
			return "/assets/img/logo/ana-logo.png"
		}
	}

	sendMessage() {
		let chatThread = this.currentChatThread();
		let lastMsg = chatThread[chatThread.length - 1];

		let msg = {
			"data": {
				"type": 2,
				"content": {
					"inputType": 0,
					"input": {
						"val": this.newMessage
					}
				}
			},
			"meta": {
				"sender": {
					"id": this.selectedCustomer.businessId,
					"medium": 3
				},
				"recipient": {
					"id": this.selectedCustomer.customerId,
					"medium": lastMsg.meta.recipient.medium
				},
				"senderType": 1,
				"id": ChatComponent.uuidv4(),
				"sessionId": lastMsg.meta.sessionId,
				"timestamp": new Date().getTime(),
				"responseTo": lastMsg.meta.id
			}
		};

		this.stompService.sendMessage(msg);
		chatThread.push(msg);
		this.newMessage = null;
	}

	currentChatThread() {
		if (this.selectedCustomer)
			return this.chatThreads[this.selectedCustomer.customerId];
		return null;
	}

	@HostListener("window:resize", ["$event"])
	onResize(event) {
		if (event.target.innerWidth < 992) {
			this.navMode = "over";
			this.leftSidenav2.close();
		}
		if (event.target.innerWidth > 992) {
			this.navMode = "side";
			this.leftSidenav2.open();
		}
	}
}

export interface meta {
	content: {
		text: string,
		mandatory
	}
}
