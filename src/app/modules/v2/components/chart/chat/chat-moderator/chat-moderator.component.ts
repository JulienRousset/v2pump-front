// chat-moderator.component.ts
import { Component, EventEmitter, Input, OnInit, Output } from '@angular/core';
import { IPageInfo } from 'ngx-virtual-scroller';
import { Subject } from 'rxjs';
import { debounceTime, distinctUntilChanged } from 'rxjs/operators';
import { NotificationService } from 'src/app/notification.service';
import { ChatService } from 'src/app/chat.service';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';

@Component({
  selector: 'app-chat-moderator',
  templateUrl: './chat-moderator.component.html',
  styleUrls: ['./chat-moderator.component.scss'],
})
export class ChatModeratorComponent implements OnInit {
  public moderators: any[] = [];
  public searchTerm: string = '';
  public isLoading: boolean = false;
  public error: string | null = null;
  private searchSubject = new Subject<string>();
  // Nouvelles propriétés
  public isAddModeratorModalOpen: boolean = false;
  public addModeratorForm: FormGroup;
  public isSubmitting: boolean = false;
  
  public offset: number = 0;
  public limit: number = 5;
  public hasMore: boolean = true;

  @Input() coinId: string = '';
  @Input() isOpen: any;
  @Output() isOpenChange = new EventEmitter<boolean>();

  constructor(
    private chatService: ChatService, 
    private notificationService: NotificationService,
    private fb: FormBuilder
  ) {
    this.searchSubject.pipe(
      debounceTime(300),
      distinctUntilChanged()
    ).subscribe(term => {
      this.resetAndSearch();
    });

       // Initialiser le formulaire
       this.addModeratorForm = this.fb.group({
        walletAddress: ['', [Validators.required, Validators.pattern('^[1-9A-HJ-NP-Za-km-z]{32,44}$')]]
      });
  }

  ngOnInit() {
    this.loadModerators();
  }

  openAddModeratorModal() {
    this.isAddModeratorModalOpen = true;
    this.addModeratorForm.reset();
  }

  closeAddModeratorModal() {
    this.isAddModeratorModalOpen = false;
    this.addModeratorForm.reset();
  }

  async onSubmitAddModerator() {
    if (this.addModeratorForm.invalid || this.isSubmitting) return;

    try {
      this.isSubmitting = true;
      const walletAddress = this.addModeratorForm.get('walletAddress')?.value;

      await this.chatService.addModerator(this.coinId, walletAddress);
      
      // Recharger la liste des modérateurs
      this.resetAndSearch();
      
      this.notificationService.showSuccess('Moderator successfully added');
      this.closeAddModeratorModal();
    } catch (error) {
      this.notificationService.showError('Failed to add moderator');
      console.error('Error adding moderator:', error);
    } finally {
      this.isSubmitting = false;
    }
  }

  // Helper pour la validation du formulaire
  get walletAddressControl() {
    return this.addModeratorForm.get('walletAddress');
  }

  getErrorMessage() {
    const control = this.walletAddressControl;
    if (control?.hasError('required')) {
      return 'Wallet address is required';
    }
    if (control?.hasError('pattern')) {
      return 'Please enter a valid Ethereum address';
    }
    return '';
  }

  private resetAndSearch() {
    this.offset = 0;
    this.moderators = [];
    this.hasMore = true;
    this.loadModerators();
  }

  async loadModerators() {
    if (!this.hasMore || this.isLoading) return;

    try {
      this.isLoading = true;
      this.error = null;

    
      const response = await this.chatService.getModerators(
        this.coinId,
        this.offset,
        this.limit,
        this.searchTerm
      )
  
      this.moderators = [...this.moderators, ...response.data.moderators];
      this.hasMore = response.data.hasMore;
      this.offset += this.limit;
    } catch (error) {
      this.error = 'Error loading moderators';
      console.error(error);
    } finally {
      this.isLoading = false;
    }
  }

  async onVsChange(event: IPageInfo) {
    const scrollPercentage = (event.endIndex + 1) / this.moderators.length;
    if (scrollPercentage > 0.9 && !this.isLoading && this.hasMore) {
      await this.loadModerators();
    }
  }

  onSearch(event: any) {
    const term = event.target.value;
    this.searchTerm = term;
    this.searchSubject.next(term);
  }

  async removeModerator(userId: string) {
    try {
      const response = await this.chatService.removeModerator(this.coinId, userId);
      if (response.status === 200) {
        this.moderators = this.moderators.filter(mod => mod.user.id !== userId);
        this.notificationService.showSuccess('Moderator successfully removed');
      } else {
        throw new Error('Failed to remove moderator');
      }
    } catch (error) {
      this.error = 'Error removing moderator';
      this.notificationService.showError('Failed to remove moderator');
      console.error(error);
    }
  }
  
  
}
