import { Injectable } from '@angular/core';
import {
    Connection,
    PublicKey,
    VersionedTransaction,
    TransactionMessage,
    Commitment,
    Transaction,
    SystemProgram,
    LAMPORTS_PER_SOL,
    ComputeBudgetProgram,
    TransactionInstruction,
    MessageV0,
    AddressLookupTableAccount
} from '@solana/web3.js';
import { HttpClient } from '@angular/common/http';
import { SolanaService } from '@shared/services/solana.service';
import * as bs58 from 'bs58';
import { NotificationService } from './notification.service';

interface QuoteResponse {
    inputMint: string;
    outputMint: string;
    amount: string;
    swapMode: string;
    slippageBps: number;
    otherAmountThreshold: string;
    priceImpactPct: number;
    routePlan: any[];
    contextSlot: number;
    timeTaken: number;
}

interface SwapResponse {
    swapTransaction: string;
}

@Injectable({
    providedIn: 'root'
})
export class JupiterService {
    private readonly JUPITER_API_URL = 'https://quote-api.jup.ag/v6';
    private readonly TRANSACTION_TIMEOUT = 60000; // 60 seconds
    private connection: Connection;
    private readonly TAX_WALLET = new PublicKey('CsKMxupdmfYpU74XXUHpG1WPKo9hRAPDidhNvNYe1x4T');

    private readonly jito_Validators = [
        "DfXygSm4jCyNCybVYYK6DwvWqjKee8pbDmJGcLWNDXjh",
        "ADuUkR4vqLUMWXxW9gh6D6L8pMSawimctcNZ5pGwDcEt",
        "3AVi9Tg9Uo68tJfuvoKvqKNWKkC5wPdSSdeBnizKZ6jT",
        "HFqU5x63VTqvQss8hp11i4wVV8bD44PvwucfZ2bU7gRe",
        "ADaUMid9yfUytqMBgopwjb2DTLSokTSzL1zt6iGPaS49",
        "Cw8CFyM9FkoMi7K7Crf6HNQqf4uEMzpKw6QNghXLvLkY",
        "DttWaMuVvTiduZRnguLF7jNxTgiMBZ1hyAumKUiL2KRL",
        "96gYZGLnJYVFmbjzopPSU6QiEV5fGqZNyN9nmNhvrZU5",
    ];

    private readonly endpoints = [
        "https://frankfurt.mainnet.block-engine.jito.wtf/api/v1/bundles"
    ];

    constructor(
        private http: HttpClient,
        public solanaService: SolanaService,
        public notificationService: NotificationService,
    ) {
        this.connection = new Connection(
            'https://wandering-billowing-moon.solana-mainnet.quiknode.pro/da55f32e52d1b381b8dc20e71c097aa7d184cbe0',
            {
                commitment: 'confirmed',
                confirmTransactionInitialTimeout: this.TRANSACTION_TIMEOUT,
                wsEndpoint: 'wss://wandering-billowing-moon.solana-mainnet.quiknode.pro/ws/da55f32e52d1b381b8dc20e71c097aa7d184cbe0'
            }
        );
    }

    private async getRandomValidator(): Promise<PublicKey> {
        const randomValidator = this.jito_Validators[
            Math.floor(Math.random() * this.jito_Validators.length)
        ];
        return new PublicKey(randomValidator);
    }

    async checkWalletBalance(): Promise<boolean> {
        try {
            if (!this.solanaService.wallet?.publicKey) {
                throw new Error('Wallet not connected');
            }
            const balance = await this.connection.getBalance(this.solanaService.wallet.publicKey);
            return balance > 0.001 * LAMPORTS_PER_SOL;
        } catch (error) {
            console.error('Error checking wallet balance:', error);
            return false;
        }
    }

    async getQuote(
        inputMint: string,
        outputMint: string,
        amount: number,
        slippageBps: number
    ): Promise<QuoteResponse> {
        try {

            const response = await this.http.get<QuoteResponse>(
                `${this.JUPITER_API_URL}/quote`,
                {
                    params: {
                        inputMint,
                        outputMint,
                        amount: amount.toString(),
                        slippageBps
                    }
                }
            ).toPromise();

            if (!response) {
                this.notificationService.showError('Error price');
                throw new Error('No quote response received');
            }

            return response;
        } catch (error) {
            console.error('Error getting quote:', error);
            throw error;
        }
    }

    async executeSwap(quoteResponse: any, priorityFeeInSol: number) {
        try {
            if (!this.solanaService.wallet?.publicKey) {
                throw new Error('Wallet non connecté');
            }

            // Calcul de la taxe
            const taxPercentage = 0.001;
            const solAmount = quoteResponse.outputMint === 'So11111111111111111111111111111111111111112'
                ? quoteResponse.outAmount
                : quoteResponse.inAmount;
            const amount = Number(solAmount) / LAMPORTS_PER_SOL;
            const finalTax = Math.max(amount * taxPercentage, 0.001);

            // Vérification du solde
            const balance = await this.connection.getBalance(this.solanaService.wallet.publicKey);
            const estimatedFees = (priorityFeeInSol + 0.01 + finalTax) * LAMPORTS_PER_SOL;

            if (balance < estimatedFees) {
                this.notificationService.showError('Insufficient balance to complete this transaction. ');
            }

            // Obtention de la transaction de swap
            const swapResponse = await this.http.post<SwapResponse>(
                `${this.JUPITER_API_URL}/swap`,
                {
                    quoteResponse,
                    userPublicKey: this.solanaService.wallet.publicKey.toString(),
                    wrapUnwrapSOL: true,
                    computeUnitPriceMicroLamports: priorityFeeInSol * 1_000_000_000,
                    skipPreflight: true
                }
            ).toPromise();

            if (!swapResponse) {
                this.notificationService.showError('Eroor Jupiter. ');
                throw new Error('Pas de réponse de Jupiter');
            }

            // Désérialisation de la transaction
            const swapTransactionBuf = Buffer.from(swapResponse.swapTransaction, 'base64');
            let transaction = VersionedTransaction.deserialize(swapTransactionBuf);

            // Création des instructions de transfert pour la taxe et les frais Jito
            const taxWallet = new PublicKey('CsKMxupdmfYpU74XXUHpG1WPKo9hRAPDidhNvNYe1x4T');
            const jito_validator_wallet = await this.getRandomValidator();

            const taxInstruction = SystemProgram.transfer({
                fromPubkey: this.solanaService.wallet.publicKey,
                toPubkey: taxWallet,
                lamports: Math.floor(finalTax * LAMPORTS_PER_SOL)
            });

            const jitoFeeInstruction = SystemProgram.transfer({
                fromPubkey: this.solanaService.wallet.publicKey,
                toPubkey: jito_validator_wallet,
                lamports: Math.floor(priorityFeeInSol * LAMPORTS_PER_SOL)
            });

            // Récupération des comptes de table de consultation d'adresses
            const addressLookupTableAccounts = await Promise.all(
                transaction.message.addressTableLookups.map(async (lookup) => {
                    return new AddressLookupTableAccount({
                        key: lookup.accountKey,
                        state: AddressLookupTableAccount.deserialize(
                            (await this.connection.getAccountInfo(lookup.accountKey))!.data
                        ),
                    });
                })
            );

            // Décompilation du message
            let message = TransactionMessage.decompile(
                transaction.message,
                { addressLookupTableAccounts }
            );

            // Ajout des instructions supplémentaires
            message.instructions.push(taxInstruction);
            message.instructions.push(jitoFeeInstruction);

            // Recompilation du message
            transaction.message = message.compileToV0Message(addressLookupTableAccounts);

            // Signature et exécution
            const signedTransaction = await this.solanaService.wallet.signTransaction(transaction);
            return await this.jito_executeAndConfirm(signedTransaction);

        } catch (error) {
            console.error('Erreur dans executeSwap:', error);
            throw error;
        }
    }


    private async jito_executeAndConfirm(transaction: VersionedTransaction) {
        try {
            if (!transaction.signatures || transaction.signatures.length === 0) {
                this.notificationService.showError('Transaction signing failed');
                throw new Error('Transaction not signed');
            }

            const serializedTransaction = transaction.serialize();
            const requests = this.endpoints.map(url =>
                fetch(url, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        jsonrpc: "2.0",
                        id: 1,
                        method: "sendBundle",
                        params: [[bs58.encode(serializedTransaction)]]
                    })
                })
            );

            const responses = await Promise.all(requests.map(p => p.catch(e => e)));
            const successResponses = responses.filter(r => !(r instanceof Error));

            if (successResponses.length > 0) {
                const signature = bs58.encode(transaction.signatures[0]);
                const latestBlockhash = await this.connection.getLatestBlockhash();
                return await this.jito_confirm(signature, latestBlockhash);
            }

            this.notificationService.showError('Transaction failed');
            return { confirmed: false, signature: null };
        } catch (error) {
            this.notificationService.showError('Transaction failed');
            console.error('Error in jito_executeAndConfirm:', error);
            return { confirmed: false, signature: null };
        }
    }

    private async jito_confirm(signature: string, latestBlockhash: any) {
        try {
            const start = Date.now();
            let confirmed = false;
            let toast = false;

            while (!confirmed && (Date.now() - start) < 15000) {
                const response = await this.connection.getSignatureStatus(signature);

                if (response && response.value && response.value.confirmationStatus === "confirmed" && !toast) {
                    this.notificationService.showSuccess('Transaction successfully completed! 🎉');
                    toast = true;
                }

                if (response && response.value && response.value.confirmationStatus === "finalized") {
                    confirmed = true;
                } else {
                    await new Promise(resolve => setTimeout(resolve, 2000));
                }
            }

            if (!confirmed && !toast) {
                this.notificationService.showError('Transaction failed. Please try again.');
            }
            return { confirmed, signature };
        } catch (error) {
            this.notificationService.showError('Transaction failed. Please try again.');
            console.error('Error confirming transaction:', error);
            return { confirmed: false, signature };
        }
    }

    async buy(
        inputMint: string,
        outputMint: string,
        amount: number,
        slippageBps: number,
        priorityFeeInSol: number
    ) {
        const quote = await this.getQuote(inputMint, outputMint, amount, slippageBps);
        return await this.executeSwap(quote, priorityFeeInSol);
    }

    async sell(
        inputMint: string,
        outputMint: string,
        amount: number,
        slippageBps: number,
        priorityFeeInSol: number
    ) {
        const quote = await this.getQuote(inputMint, outputMint, amount, slippageBps);
        return await this.executeSwap(quote, priorityFeeInSol);
    }



    async checkTransactionStatus(signature: string) {
        try {
            return await this.connection.getSignatureStatus(signature);
        } catch (error) {
            console.error('Error checking transaction status:', error);
            throw error;
        }
    }
}
