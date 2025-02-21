import { Injectable } from '@angular/core';
import { Subject } from 'rxjs';

@Injectable({
    providedIn: 'root'
})
export class EventsService {
    private transactionFinalized = new Subject<string>();
    
    transactionFinalized$ = this.transactionFinalized.asObservable();

    emitTransactionFinalized(signature: string) {
        this.transactionFinalized.next(signature);
    }
}