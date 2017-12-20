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
import * as models from '../../shared/model/ana-chat.models';
import { ANAChatMessage } from "../../shared/model/ana-chat.models";
import { setTimeout } from "timers";
import { InfoDialogService } from "app/shared/services/helpers/info-dialog.service";

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
	JSON = JSON;
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
		private infoDialog: InfoDialogService,
		@Inject(DOCUMENT) private _doc: Document
	) {
		this.stompService.handleMessageReceived = (msg) => {
			if (msg.data && Object.keys(msg.data).length > 0) {

				this.addMsgToThread(msg.meta.sender.id, msg);

				if (!this.selectedCustomer || this.selectedCustomer.customerId != msg.meta.sender.id) {
					let cust = this.customersList.filter(x => x.customerId == msg.meta.sender.id);
					if (cust && cust.length > 0)
						cust[0].unreadCount++;
				}

				if (this.selectedCustomer && this.selectedCustomer.customerId == msg.meta.sender.id) {
					this.scrollActiveChatToBottom();
				}
			};
		}
		this.stompService.handleNewChat = (custInfo) => {
			this.customersList.unshift(custInfo);
		};
	}

	addMsgToCurrentThread(msg: any) {
		let thread = this.currentChatThread();
		if (thread.filter(x => x.meta.id == msg.meta.id).length > 0)
			return;
		thread.push(msg);
	}

	addMsgToThread(custId: string, msg: any) {
		if (!this.chatThreads[custId])
			this.chatThreads[custId] = [];
		if (this.chatThreads[custId].filter(x => x.meta.id == msg.meta.id).length > 0)
			return;
		this.chatThreads[custId].push(msg);
	}

	insertMsgToThread(custId: string, msg: any) {
		if (!this.chatThreads[custId])
			this.chatThreads[custId] = [];
		if (this.chatThreads[custId].filter(x => x.meta.id == msg.meta.id).length > 0)
			return;
		this.chatThreads[custId].unshift(msg);
	}

	static uuidv4() {
		return (<any>[1e7] + -1e3 + -4e3 + -8e3 + -1e11).toString().replace(/[018]/g,
			c => (<any>c ^ crypto.getRandomValues(new Uint8Array(1))[0] & 15 >> <any>c / 4).toString(16)
		)
	}

	scrollActiveChatToBottom() {

		let scrollEle = this.myScrollContainer.nativeElement as HTMLDivElement;
		// window.requestAnimationFrame(() => {
		// 	scrollEle.children.item(scrollEle.children.length - 1).scrollIntoView({ behavior: 'instant' });
		// });

		// console.log(scrollEle);
		// console.log(scrollEle.scrollTo);
		// console.log(scrollEle.scrollBy);

		window.requestAnimationFrame(() => scrollEle.scrollTop = scrollEle.scrollHeight);
	}

	logout() {
		this.dataService.logout();
		this.stompService.disconnect();
		this.router.navigateByUrl('/');
	}
	onCustomerSelected(cust: ChatCustomerInfo) {
		this.selectedCustomer = cust;
		this.selectedCustomer.unreadCount = 0;

		if (!this.chatThreads[cust.customerId]) {
			this.dataService.getHistory(cust.customerId, cust.businessId, 20, 0).subscribe(resData => {
				try {
					let history: any[] = resData.content.reverse();
					this.chatThreads[cust.customerId] = history.filter(x => (x.data.type == 0) || (x.data.type == 2 && x.data.content.input && x.data.content.input.val));//Filtering only text inputs for now.
					this.scrollActiveChatToBottom();
				}
				catch (e) {
					console.log(e);
					debugger;
				}
			});
		}
		else {
			this.scrollActiveChatToBottom();
		}
	}
	isCustomerSelected(cust: ChatCustomerInfo) {
		if (this.selectedCustomer && this.selectedCustomer.customerId == cust.customerId)
			return true;
		return false;
	}
	isChatMessageHidden(chatMsg: any) {
		const HIDE = true;

		if (chatMsg.data.type == 2 && (!chatMsg.data.content.input || !chatMsg.data.content.input.val)) {
			return HIDE;
		}
		return !HIDE;
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
				this.infoDialog.alert('Unable to get the chats', resData.error.message);
			} else {
				this.customersList = resData.data.content;
				this.stompService.handleConnect = () => {
					this.stompService.allChatsSubscription(this.customersList);

					if (this.customersList && this.customersList.length > 0)
						this.onCustomerSelected(this.customersList[0]);
				};
				this.stompService.connect({
					debug: true,
					endpoint: this.configService.app.webSocketEndPoint
				});
			}
		});
	}

	loadingHistory = false;
	onScroll(event: UIEvent) {
		if (this.loadingHistory)
			return;

		let scrollEle = this.myScrollContainer.nativeElement as HTMLDivElement;
		let oldScrollHeight = scrollEle.scrollHeight;
		if (scrollEle.scrollTop <= 2) {
			let thread = this.currentChatThread();
			if (thread && thread.length > 0) {
				this.loadingHistory = true;
				this.dataService.getHistory(this.selectedCustomer.customerId, this.selectedCustomer.businessId, 20, 0, thread[0].meta.timestamp).subscribe(resData => {
					try {
						resData.content.forEach(x => {
							if (thread.filter(msg => msg.meta.id == x.meta.id).length > 0)
								return;
							thread.unshift(x);
						});
						window.requestAnimationFrame(() => {
							scrollEle.scrollTop = (scrollEle.scrollHeight - oldScrollHeight);
						});
					} finally {
						this.loadingHistory = false;
					}
				})
			}
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
			return "assets/img/profiles/avatar.png"
		}
		else {
			return "assets/img/ana.svg"
		}
	}

	sendMessage() {
		let chatThread = this.currentChatThread();
		let lastMsg = chatThread[chatThread.length - 1];
		if (!lastMsg) {
			this.infoDialog.alert('Oops!', 'Message thread is empty! Donno the session id!');
			return;
		}
		let msg = {
			"data": {
				"type": 2,
				"content": {
					"inputType": 0,
					"input": {
						"val": this.newMessage
					},
					"mandatory": 1,
					"multiple": 0,
					"textInputAttr": {
						"multiLine": 0,
						"minLength": 0,
						"maxLength": 0,
						"placeHolder": ""
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
				"senderType": 3,
				"id": ChatComponent.uuidv4(),
				"sessionId": lastMsg.meta.sessionId,
				"timestamp": new Date().getTime(),
				"responseTo": lastMsg.meta.id
			}
		};

		this.stompService.sendMessage(msg);
		chatThread.push(msg);
		this.scrollActiveChatToBottom();
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

	optionsText(chatMsg: any) {
		try {
			let options = chatMsg.data.content.options as any[];
			return options.filter(x => x.value == chatMsg.data.content.input.val)[0].title;
		} catch (e) {
			console.log(e);
			return "";
		}
	}
}

export interface meta {
	content: {
		text: string,
		mandatory
	}
}
