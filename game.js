(() => {
    'use strict';

    const SUITS = [
        { name: 'spades', symbol: '♠', color: 'black' },
        { name: 'hearts', symbol: '♥', color: 'red' },
        { name: 'diamonds', symbol: '♦', color: 'red' },
        { name: 'clubs', symbol: '♣', color: 'black' }
    ];

    const RANKS = [
        { rank: 'A', value: 11 },
        { rank: 'K', value: 10 },
        { rank: 'Q', value: 10 },
        { rank: 'J', value: 10 },
        { rank: '10', value: 10 },
        { rank: '9', value: 9 },
        { rank: '8', value: 8 },
        { rank: '7', value: 7 },
        { rank: '6', value: 6 },
        { rank: '5', value: 5 },
        { rank: '4', value: 4 },
        { rank: '3', value: 3 },
        { rank: '2', value: 2 }
    ];

    const currencyFormatter = new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
        maximumFractionDigits: 0
    });

    const formatCurrency = (value) => {
        const safeValue = Number.isFinite(value) ? Math.floor(value) : 0;
        return currencyFormatter.format(Math.max(0, safeValue));
    };

    class Shoe {
        constructor(deckCount = 6) {
            this.deckCount = deckCount;
            this.cards = [];
            this.cutCardIndex = Math.floor(52 * this.deckCount * 0.25);
            this.shuffle();
        }

        buildDeck() {
            const deck = [];
            for (const suit of SUITS) {
                for (const rank of RANKS) {
                    deck.push({
                        rank: rank.rank,
                        value: rank.value,
                        suit: suit.name,
                        symbol: suit.symbol,
                        color: suit.color
                    });
                }
            }
            return deck;
        }

        shuffle() {
            this.cards = [];
            for (let i = 0; i < this.deckCount; i += 1) {
                this.cards.push(...this.buildDeck());
            }
            for (let i = this.cards.length - 1; i > 0; i -= 1) {
                const j = Math.floor(Math.random() * (i + 1));
                [this.cards[i], this.cards[j]] = [this.cards[j], this.cards[i]];
            }
        }

        needsShuffle() {
            return this.cards.length <= this.cutCardIndex;
        }

        draw() {
            if (this.cards.length === 0) {
                this.shuffle();
            }
            return this.cards.pop();
        }

        remaining() {
            return this.cards.length;
        }

        total() {
            return 52 * this.deckCount;
        }
    }

    class BlackjackGame {
        constructor() {
            this.dom = this.mapDom();
            if (!this.dom || !this.dom.dealButton) {
                console.error('Blackjack UI is missing.');
                return;
            }

            this.rules = {
                decks: 6,
                hitSoft17: false,
                blackjackPayout: 1.5,
                minBet: 5
            };

            this.defaultBank = 1000;
            this.storageKey = 'pulseBlackjackState';

            this.cardId = 1;
            this.renderedCardIds = new Set();
            this.revealedCardIds = new Set();

            this.stats = {
                hands: 0,
                wins: 0,
                losses: 0,
                pushes: 0,
                blackjacks: 0,
                streak: 0
            };

            this.settings = {
                reducedMotion: window.matchMedia
                    ? window.matchMedia('(prefers-reduced-motion: reduce)').matches
                    : false
            };

            this.bank = this.defaultBank;
            this.previousBet = 0;

            this.loadState();

            this.shoe = new Shoe(this.rules.decks);
            this.phase = 'betting';
            this.currentBet = 0;
            this.playerHands = [];
            this.dealerHand = [];
            this.currentHandIndex = 0;
            this.insuranceBet = 0;
            this.dealerHasBlackjack = false;
            this.dealerActing = false;

            this.bindEvents();
            this.applySettings();
            this.enterBettingPhase();
        }

        mapDom() {
            const qs = (selector) => document.querySelector(selector);
            const qsa = (selector) => Array.from(document.querySelectorAll(selector));

            return {
                bankValue: qs('#bankValue'),
                betValue: qs('#betValue'),
                shoeValue: qs('#shoeValue'),
                dealerTotal: qs('#dealerTotal'),
                dealerHand: qs('#dealerHand'),
                playerTotal: qs('#playerTotal'),
                playerHands: qs('#playerHands'),
                message: qs('#message'),
                chipButtons: qsa('.chip'),
                clearBet: qs('#clearBet'),
                rebet: qs('#rebet'),
                dealButton: qs('#dealButton'),
                hitButton: qs('#hitButton'),
                standButton: qs('#standButton'),
                doubleButton: qs('#doubleButton'),
                splitButton: qs('#splitButton'),
                insuranceButton: qs('#insuranceButton'),
                skipInsuranceButton: qs('#skipInsuranceButton'),
                nextRoundButton: qs('#nextRoundButton'),
                handsStat: qs('#handsStat'),
                winsStat: qs('#winsStat'),
                lossesStat: qs('#lossesStat'),
                pushesStat: qs('#pushesStat'),
                blackjacksStat: qs('#blackjacksStat'),
                streakStat: qs('#streakStat'),
                helpModal: qs('#helpModal'),
                settingsModal: qs('#settingsModal'),
                helpButton: qs('#helpButton'),
                settingsButton: qs('#settingsButton'),
                closeHelp: qs('#closeHelp'),
                closeSettings: qs('#closeSettings'),
                resetBankButton: qs('#resetBankButton'),
                reduceMotionToggle: qs('#reduceMotionToggle')
            };
        }

        bindEvents() {
            this.dom.chipButtons.forEach((button) => {
                button.addEventListener('click', () => {
                    const value = Number(button.dataset.value || 0);
                    this.placeBet(value);
                });
            });

            this.dom.clearBet.addEventListener('click', () => this.clearBet());
            this.dom.rebet.addEventListener('click', () => this.rebet());
            this.dom.dealButton.addEventListener('click', () => this.startRound());

            this.dom.hitButton.addEventListener('click', () => this.hit());
            this.dom.standButton.addEventListener('click', () => this.stand());
            this.dom.doubleButton.addEventListener('click', () => this.doubleDown());
            this.dom.splitButton.addEventListener('click', () => this.split());
            this.dom.insuranceButton.addEventListener('click', () => this.takeInsurance());
            this.dom.skipInsuranceButton.addEventListener('click', () => this.declineInsurance());
            this.dom.nextRoundButton.addEventListener('click', () => this.enterBettingPhase());

            if (this.dom.helpButton) {
                this.dom.helpButton.addEventListener('click', () => {
                    this.toggleModal(this.dom.helpModal, true);
                });
            }

            if (this.dom.settingsButton) {
                this.dom.settingsButton.addEventListener('click', () => {
                    this.toggleModal(this.dom.settingsModal, true);
                });
            }

            if (this.dom.closeHelp) {
                this.dom.closeHelp.addEventListener('click', () => {
                    this.toggleModal(this.dom.helpModal, false);
                });
            }

            if (this.dom.closeSettings) {
                this.dom.closeSettings.addEventListener('click', () => {
                    this.toggleModal(this.dom.settingsModal, false);
                });
            }

            if (this.dom.resetBankButton) {
                this.dom.resetBankButton.addEventListener('click', () => this.resetBank());
            }

            if (this.dom.reduceMotionToggle) {
                this.dom.reduceMotionToggle.addEventListener('change', (event) => {
                    this.settings.reducedMotion = event.target.checked;
                    this.applySettings();
                    this.saveState();
                });
            }
        }

        applySettings() {
            document.body.classList.toggle('reduce-motion', Boolean(this.settings.reducedMotion));
            if (this.dom.reduceMotionToggle) {
                this.dom.reduceMotionToggle.checked = Boolean(this.settings.reducedMotion);
            }
        }

        toggleModal(modal, show) {
            if (!modal) return;
            modal.classList.toggle('hidden', !show);
        }

        loadState() {
            try {
                const raw = localStorage.getItem(this.storageKey);
                if (!raw) return;
                const saved = JSON.parse(raw);
                if (!saved || typeof saved !== 'object') return;

                if (Number.isFinite(saved.bank)) {
                    this.bank = saved.bank;
                }

                if (Number.isFinite(saved.previousBet)) {
                    this.previousBet = saved.previousBet;
                }

                if (saved.stats && typeof saved.stats === 'object') {
                    this.stats.hands = Number(saved.stats.hands) || 0;
                    this.stats.wins = Number(saved.stats.wins) || 0;
                    this.stats.losses = Number(saved.stats.losses) || 0;
                    this.stats.pushes = Number(saved.stats.pushes) || 0;
                    this.stats.blackjacks = Number(saved.stats.blackjacks) || 0;
                    this.stats.streak = Number(saved.stats.streak) || 0;
                }

                if (saved.settings && typeof saved.settings === 'object') {
                    this.settings.reducedMotion = Boolean(saved.settings.reducedMotion);
                }
            } catch (error) {
                console.warn('Unable to load saved state.', error);
            }
        }

        saveState() {
            try {
                const payload = {
                    bank: this.bank,
                    previousBet: this.previousBet,
                    stats: this.stats,
                    settings: this.settings
                };
                localStorage.setItem(this.storageKey, JSON.stringify(payload));
            } catch (error) {
                console.warn('Unable to save state.', error);
            }
        }

        setMessage(text) {
            if (this.dom.message) {
                this.dom.message.textContent = text;
            }
        }

        enterBettingPhase() {
            this.phase = 'betting';
            this.currentBet = 0;
            this.playerHands = [];
            this.dealerHand = [];
            this.currentHandIndex = 0;
            this.insuranceBet = 0;
            this.dealerHasBlackjack = false;
            this.dealerActing = false;
            this.renderedCardIds.clear();
            this.revealedCardIds.clear();
            this.setMessage('Place your bet.');
            this.updateUI();
        }

        resetBank() {
            this.bank = this.defaultBank;
            this.previousBet = 0;
            this.currentBet = 0;
            this.playerHands = [];
            this.dealerHand = [];
            this.phase = 'betting';
            this.setMessage('Bank reset. Place your bet.');
            this.saveState();
            this.updateUI();
        }

        placeBet(amount) {
            if (this.phase !== 'betting') return;
            if (!Number.isFinite(amount) || amount <= 0) return;

            if (this.currentBet + amount > this.bank) {
                this.setMessage('Not enough funds for that bet.');
                return;
            }

            this.currentBet += amount;
            this.setMessage('Ready to deal.');
            this.updateUI();
        }

        clearBet() {
            if (this.phase !== 'betting') return;
            this.currentBet = 0;
            this.setMessage('Bet cleared.');
            this.updateUI();
        }

        rebet() {
            if (this.phase !== 'betting') return;
            if (!this.previousBet || this.previousBet <= 0) {
                this.setMessage('No previous bet to repeat.');
                return;
            }
            if (this.previousBet > this.bank) {
                this.setMessage('Not enough bank to rebet.');
                return;
            }
            this.currentBet = this.previousBet;
            this.setMessage('Bet matched. Ready to deal.');
            this.updateUI();
        }

        startRound() {
            if (this.phase !== 'betting') return;
            if (this.currentBet <= 0) {
                this.setMessage('Place a bet to start.');
                return;
            }
            if (this.currentBet > this.bank) {
                this.setMessage('Not enough bank for that bet.');
                return;
            }

            this.phase = 'dealing';
            this.bank -= this.currentBet;
            this.playerHands = [this.createHand(this.currentBet)];
            this.dealerHand = [];
            this.currentHandIndex = 0;
            this.insuranceBet = 0;
            this.dealerHasBlackjack = false;
            this.renderedCardIds.clear();
            this.revealedCardIds.clear();

            this.dealInitialCards();

            this.previousBet = this.playerHands[0].bet;
            this.currentBet = 0;
            this.updateUI();
            this.handlePostDeal();
        }

        createHand(bet) {
            return {
                id: `hand-${Date.now()}-${Math.random().toString(16).slice(2)}`,
                cards: [],
                bet,
                status: 'active',
                isDoubled: false,
                isSplitHand: false,
                isSplitAces: false,
                outcome: null
            };
        }

        dealInitialCards() {
            const playerHand = this.playerHands[0];
            playerHand.cards.push(this.drawCard());
            this.dealerHand.push(this.drawCard());
            playerHand.cards.push(this.drawCard());

            const holeCard = this.drawCard();
            holeCard.isHidden = true;
            this.dealerHand.push(holeCard);
        }

        handlePostDeal() {
            const playerHand = this.playerHands[0];
            const playerEval = this.evaluateHand(playerHand.cards, { allowBlackjack: true });
            this.dealerHasBlackjack = this.evaluateHand(this.dealerHand, { allowBlackjack: true }).isBlackjack;

            if (playerEval.isBlackjack) {
                this.resolvePlayerBlackjack();
                return;
            }

            const dealerUpcard = this.dealerHand[0];
            if (dealerUpcard && dealerUpcard.rank === 'A') {
                this.phase = 'insurance';
                this.setMessage('Dealer shows an Ace. Insurance?');
                this.updateUI();
                return;
            }

            if (dealerUpcard && this.isTenValue(dealerUpcard) && this.dealerHasBlackjack) {
                this.resolveDealerBlackjack();
                return;
            }

            this.phase = 'player_turn';
            this.setMessage('Your move. Hit or stand.');
            this.updateUI();
        }

        resolvePlayerBlackjack() {
            const hand = this.playerHands[0];
            this.revealDealerHoleCard();
            const dealerEval = this.evaluateHand(this.dealerHand, { allowBlackjack: true });

            if (dealerEval.isBlackjack) {
                hand.outcome = 'push';
                hand.status = 'stood';
                this.bank += hand.bet;
                this.recordOutcome('push');
                this.setMessage('Push. Both blackjack.');
            } else {
                hand.outcome = 'blackjack';
                hand.status = 'blackjack';
                const payout = hand.bet * (1 + this.rules.blackjackPayout);
                this.bank += payout;
                this.recordOutcome('win', true);
                this.setMessage('Blackjack. Paid 3 to 2.');
            }

            this.finishRound();
        }

        resolveDealerBlackjack() {
            this.revealDealerHoleCard();
            if (this.insuranceBet > 0) {
                this.bank += this.insuranceBet * 3;
            }

            this.playerHands.forEach((hand) => {
                hand.outcome = 'loss';
                hand.status = 'stood';
                this.recordOutcome('loss');
            });

            const insuranceNote = this.insuranceBet > 0 ? ' Insurance paid.' : '';
            this.setMessage(`Dealer has blackjack.${insuranceNote}`);
            this.finishRound();
        }

        takeInsurance() {
            if (this.phase !== 'insurance') return;
            const hand = this.playerHands[0];
            if (!hand) return;

            const maxInsurance = Math.min(Math.floor(hand.bet / 2), this.bank);
            if (maxInsurance <= 0) {
                this.setMessage('Not enough bank for insurance.');
                return;
            }

            this.insuranceBet = maxInsurance;
            this.bank -= maxInsurance;
            this.resolveInsuranceDecision();
        }

        declineInsurance() {
            if (this.phase !== 'insurance') return;
            this.insuranceBet = 0;
            this.resolveInsuranceDecision();
        }

        resolveInsuranceDecision() {
            if (this.dealerHasBlackjack) {
                this.resolveDealerBlackjack();
                return;
            }

            if (this.insuranceBet > 0) {
                this.setMessage('No blackjack. Insurance lost. Your move.');
            } else {
                this.setMessage('No insurance. Your move.');
            }

            this.phase = 'player_turn';
            this.updateUI();
        }

        hit() {
            if (this.phase !== 'player_turn') return;
            const hand = this.getActiveHand();
            if (!this.canHit(hand)) return;

            hand.cards.push(this.drawCard());
            const evaluation = this.evaluateHand(hand.cards, { allowBlackjack: !hand.isSplitHand });

            if (evaluation.isBusted) {
                hand.status = 'busted';
                this.advanceHand();
                return;
            }

            if (evaluation.total === 21) {
                hand.status = 'stood';
                this.advanceHand();
                return;
            }

            this.updateUI();
        }

        stand() {
            if (this.phase !== 'player_turn') return;
            const hand = this.getActiveHand();
            if (!hand) return;
            hand.status = 'stood';
            this.advanceHand();
        }

        doubleDown() {
            if (this.phase !== 'player_turn') return;
            const hand = this.getActiveHand();
            if (!this.canDouble(hand)) return;

            this.bank -= hand.bet;
            hand.bet += hand.bet;
            hand.isDoubled = true;
            hand.cards.push(this.drawCard());

            const evaluation = this.evaluateHand(hand.cards, { allowBlackjack: !hand.isSplitHand });
            if (evaluation.isBusted) {
                hand.status = 'busted';
            } else {
                hand.status = 'stood';
            }

            this.advanceHand();
        }

        split() {
            if (this.phase !== 'player_turn') return;
            const hand = this.getActiveHand();
            if (!this.canSplit(hand)) return;

            const [firstCard, secondCard] = hand.cards;
            const newHand = this.createHand(hand.bet);
            newHand.cards = [secondCard];
            newHand.isSplitHand = true;

            hand.cards = [firstCard];
            hand.isSplitHand = true;

            this.bank -= hand.bet;
            this.playerHands.splice(this.currentHandIndex + 1, 0, newHand);

            const splitAces = firstCard.rank === 'A' && secondCard.rank === 'A';
            if (splitAces) {
                hand.isSplitAces = true;
                newHand.isSplitAces = true;
            }

            hand.cards.push(this.drawCard());
            newHand.cards.push(this.drawCard());

            if (splitAces) {
                hand.status = 'stood';
                newHand.status = 'stood';
                this.advanceHand();
                return;
            }

            const evaluation = this.evaluateHand(hand.cards, { allowBlackjack: false });
            if (evaluation.total === 21) {
                hand.status = 'stood';
                this.advanceHand();
                return;
            }

            this.setMessage(`Hand ${this.currentHandIndex + 1}: Your move.`);
            this.updateUI();
        }

        advanceHand() {
            let nextIndex = this.currentHandIndex + 1;
            while (nextIndex < this.playerHands.length) {
                const hand = this.playerHands[nextIndex];
                if (this.isHandComplete(hand)) {
                    nextIndex += 1;
                    continue;
                }

                const evaluation = this.evaluateHand(hand.cards, { allowBlackjack: !hand.isSplitHand });
                if (evaluation.total >= 21) {
                    hand.status = evaluation.isBusted ? 'busted' : 'stood';
                    nextIndex += 1;
                    continue;
                }

                break;
            }

            this.currentHandIndex = nextIndex;

            if (this.currentHandIndex >= this.playerHands.length) {
                void this.startDealerTurn();
                return;
            }

            this.setMessage(`Hand ${this.currentHandIndex + 1}: Your move.`);
            this.updateUI();
        }

        async startDealerTurn() {
            if (this.dealerActing) return;
            this.dealerActing = true;
            this.phase = 'dealer_turn';
            this.revealDealerHoleCard();
            this.setMessage('Dealer plays.');
            this.updateUI();

            const waitTime = this.settings.reducedMotion ? 0 : 350;
            if (waitTime) {
                await this.wait(waitTime);
            }

            let dealerEval = this.evaluateHand(this.dealerHand, { allowBlackjack: true });
            while (
                dealerEval.total < 17 ||
                (dealerEval.total === 17 && dealerEval.isSoft && this.rules.hitSoft17)
            ) {
                this.dealerHand.push(this.drawCard());
                this.updateUI();
                if (waitTime) {
                    await this.wait(waitTime);
                }
                dealerEval = this.evaluateHand(this.dealerHand, { allowBlackjack: true });
            }

            this.dealerActing = false;
            this.settleHands();
        }

        settleHands() {
            const dealerEval = this.evaluateHand(this.dealerHand, { allowBlackjack: true });
            const dealerBust = dealerEval.total > 21;
            let wins = 0;
            let losses = 0;
            let pushes = 0;

            this.playerHands.forEach((hand) => {
                const evaluation = this.evaluateHand(hand.cards, { allowBlackjack: !hand.isSplitHand });

                if (evaluation.isBusted) {
                    hand.outcome = 'loss';
                    losses += 1;
                    this.recordOutcome('loss');
                    return;
                }

                if (dealerBust) {
                    hand.outcome = 'win';
                    wins += 1;
                    this.bank += hand.bet * 2;
                    this.recordOutcome('win');
                    return;
                }

                if (evaluation.total > dealerEval.total) {
                    hand.outcome = 'win';
                    wins += 1;
                    this.bank += hand.bet * 2;
                    this.recordOutcome('win');
                    return;
                }

                if (evaluation.total < dealerEval.total) {
                    hand.outcome = 'loss';
                    losses += 1;
                    this.recordOutcome('loss');
                    return;
                }

                hand.outcome = 'push';
                pushes += 1;
                this.bank += hand.bet;
                this.recordOutcome('push');
            });

            let message = 'Round complete.';
            if (wins > 0 && losses === 0) {
                message = wins > 1 ? 'You win both hands.' : 'You win.';
            } else if (losses > 0 && wins === 0) {
                message = losses > 1 ? 'Dealer wins both hands.' : 'Dealer wins.';
            } else if (wins > 0 && losses > 0) {
                message = 'Split result. Tap Next Round.';
            } else if (pushes > 0) {
                message = 'Push. Tap Next Round.';
            }

            if (dealerBust && wins > 0) {
                message = 'Dealer busts. You win.';
            }

            this.setMessage(message);
            this.finishRound();
        }

        finishRound() {
            this.phase = 'round_end';
            this.insuranceBet = 0;
            this.saveState();
            this.updateUI();
        }

        recordOutcome(result, blackjack = false) {
            this.stats.hands += 1;

            if (result === 'win') {
                this.stats.wins += 1;
                if (blackjack) {
                    this.stats.blackjacks += 1;
                }
                this.stats.streak = this.stats.streak >= 0 ? this.stats.streak + 1 : 1;
            } else if (result === 'loss') {
                this.stats.losses += 1;
                this.stats.streak = this.stats.streak <= 0 ? this.stats.streak - 1 : -1;
            } else {
                this.stats.pushes += 1;
                this.stats.streak = 0;
            }
        }

        drawCard() {
            if (this.shoe.needsShuffle()) {
                this.shoe.shuffle();
                if (this.phase === 'betting') {
                    this.setMessage('Shuffling the shoe.');
                }
            }

            let card = this.shoe.draw();
            if (!card) {
                this.shoe.shuffle();
                card = this.shoe.draw();
            }

            card.uid = `card-${this.cardId}`;
            this.cardId += 1;
            card.isHidden = false;
            card.revealed = false;
            return card;
        }

        revealDealerHoleCard() {
            this.dealerHand.forEach((card) => {
                if (card.isHidden) {
                    card.isHidden = false;
                    card.revealed = true;
                }
            });
        }

        evaluateHand(cards, options = {}) {
            const allowBlackjack = options.allowBlackjack !== false;
            let total = 0;
            let aces = 0;

            cards.forEach((card) => {
                if (card.rank === 'A') {
                    aces += 1;
                } else {
                    total += card.value;
                }
            });

            total += aces;
            let isSoft = false;
            if (aces > 0 && total + 10 <= 21) {
                total += 10;
                isSoft = true;
            }

            const isBlackjack = allowBlackjack && cards.length === 2 && total === 21;
            return {
                total,
                isSoft,
                isBlackjack,
                isBusted: total > 21
            };
        }

        getSplitValue(card) {
            if (card.rank === 'A') return 11;
            if (['K', 'Q', 'J', '10'].includes(card.rank)) return 10;
            const parsed = Number(card.rank);
            return Number.isFinite(parsed) ? parsed : 0;
        }

        isTenValue(card) {
            return ['10', 'J', 'Q', 'K'].includes(card.rank);
        }

        getActiveHand() {
            return this.playerHands[this.currentHandIndex] || null;
        }

        isHandComplete(hand) {
            return ['stood', 'busted', 'blackjack'].includes(hand.status);
        }

        canHit(hand) {
            if (!hand || this.phase !== 'player_turn') return false;
            if (hand.isSplitAces) return false;
            const evaluation = this.evaluateHand(hand.cards, { allowBlackjack: !hand.isSplitHand });
            return !evaluation.isBusted && evaluation.total < 21;
        }

        canDouble(hand) {
            if (!hand || this.phase !== 'player_turn') return false;
            if (hand.cards.length !== 2) return false;
            if (hand.isDoubled || hand.isSplitAces) return false;
            if (this.bank < hand.bet) return false;
            const evaluation = this.evaluateHand(hand.cards, { allowBlackjack: !hand.isSplitHand });
            return !evaluation.isBusted;
        }

        canSplit(hand) {
            if (!hand || this.phase !== 'player_turn') return false;
            if (hand.cards.length !== 2) return false;
            if (this.playerHands.length >= 2) return false;
            if (this.bank < hand.bet) return false;
            const [first, second] = hand.cards;
            if (!first || !second) return false;
            return this.getSplitValue(first) === this.getSplitValue(second);
        }

        updateUI() {
            if (this.dom.bankValue) {
                this.dom.bankValue.textContent = formatCurrency(this.bank);
            }

            if (this.dom.betValue) {
                this.dom.betValue.textContent = formatCurrency(this.getTotalBet());
            }

            if (this.dom.shoeValue) {
                this.dom.shoeValue.textContent = `${this.rules.decks}D | ${this.getShoePercent()}%`;
            }

            if (this.dom.dealerTotal) {
                this.dom.dealerTotal.textContent = this.getDealerDisplayTotal();
            }

            if (this.dom.playerTotal) {
                const activeHand = this.getActiveHand();
                this.dom.playerTotal.textContent = activeHand ? this.getHandTotal(activeHand) : '--';
            }

            this.renderHands();
            this.updateControls();
            this.updateStats();
        }

        updateStats() {
            if (this.dom.handsStat) this.dom.handsStat.textContent = this.stats.hands;
            if (this.dom.winsStat) this.dom.winsStat.textContent = this.stats.wins;
            if (this.dom.lossesStat) this.dom.lossesStat.textContent = this.stats.losses;
            if (this.dom.pushesStat) this.dom.pushesStat.textContent = this.stats.pushes;
            if (this.dom.blackjacksStat) this.dom.blackjacksStat.textContent = this.stats.blackjacks;
            if (this.dom.streakStat) this.dom.streakStat.textContent = this.stats.streak;
        }

        updateControls() {
            const inBetting = this.phase === 'betting';
            const inPlayerTurn = this.phase === 'player_turn';
            const inInsurance = this.phase === 'insurance';
            const inRoundEnd = this.phase === 'round_end';
            const activeHand = this.getActiveHand();

            this.dom.chipButtons.forEach((button) => {
                const value = Number(button.dataset.value || 0);
                button.disabled = !inBetting || this.currentBet + value > this.bank;
            });

            this.dom.clearBet.disabled = !inBetting || this.currentBet === 0;
            this.dom.rebet.disabled = !inBetting || this.previousBet <= 0 || this.previousBet > this.bank;
            this.dom.dealButton.disabled = !inBetting || this.currentBet === 0;

            this.dom.hitButton.disabled = !inPlayerTurn || !this.canHit(activeHand);
            this.dom.standButton.disabled = !inPlayerTurn || !activeHand;
            this.dom.doubleButton.disabled = !inPlayerTurn || !this.canDouble(activeHand);
            this.dom.splitButton.disabled = !inPlayerTurn || !this.canSplit(activeHand);

            const insuranceLimit =
                inInsurance && this.playerHands[0]
                    ? Math.min(Math.floor(this.playerHands[0].bet / 2), this.bank)
                    : 0;

            if (this.dom.insuranceButton) {
                this.dom.insuranceButton.classList.toggle('is-hidden', !inInsurance);
                this.dom.insuranceButton.textContent =
                    insuranceLimit > 0 ? `Insurance ${formatCurrency(insuranceLimit)}` : 'Insurance';
                this.dom.insuranceButton.disabled = insuranceLimit <= 0;
            }

            if (this.dom.skipInsuranceButton) {
                this.dom.skipInsuranceButton.classList.toggle('is-hidden', !inInsurance);
                this.dom.skipInsuranceButton.disabled = !inInsurance;
            }

            if (this.dom.nextRoundButton) {
                this.dom.nextRoundButton.classList.toggle('is-hidden', !inRoundEnd);
                this.dom.nextRoundButton.disabled = !inRoundEnd;
            }
        }

        renderHands() {
            if (this.dom.dealerHand) {
                this.dom.dealerHand.innerHTML = '';
                this.dealerHand.forEach((card) => {
                    this.dom.dealerHand.appendChild(this.createCardElement(card));
                });
            }

            if (this.dom.playerHands) {
                this.dom.playerHands.innerHTML = '';
                this.playerHands.forEach((hand, index) => {
                    const handElement = document.createElement('div');
                    handElement.className = 'player-hand';
                    if (this.phase === 'player_turn' && index === this.currentHandIndex) {
                        handElement.classList.add('is-active');
                    }

                    const header = document.createElement('div');
                    header.className = 'hand-header';

                    const name = document.createElement('div');
                    name.textContent = `Hand ${index + 1}`;

                    const bet = document.createElement('div');
                    bet.textContent = formatCurrency(hand.bet);

                    header.appendChild(name);
                    header.appendChild(bet);

                    const status = document.createElement('div');
                    status.className = 'hand-status';
                    status.textContent = this.getHandStatusLabel(hand, index);

                    const cards = document.createElement('div');
                    cards.className = 'hand-cards';
                    hand.cards.forEach((card) => {
                        cards.appendChild(this.createCardElement(card));
                    });

                    const total = document.createElement('div');
                    total.className = 'hand-total';
                    total.textContent = this.getHandTotalText(hand);

                    handElement.appendChild(header);
                    if (status.textContent) {
                        handElement.appendChild(status);
                    }
                    handElement.appendChild(cards);
                    handElement.appendChild(total);

                    this.dom.playerHands.appendChild(handElement);
                });
            }
        }

        createCardElement(card) {
            const cardElement = document.createElement('div');
            cardElement.className = 'card';

            if (card.isHidden) {
                cardElement.classList.add('card-back');
                const center = document.createElement('div');
                center.className = 'center';
                center.textContent = 'BJ';
                cardElement.appendChild(center);
            } else {
                cardElement.classList.add(card.color === 'red' ? 'red' : 'black');
                const top = document.createElement('div');
                top.className = 'corner top';
                top.textContent = `${card.rank}${card.symbol}`;

                const center = document.createElement('div');
                center.className = 'center';
                center.textContent = card.symbol;

                const bottom = document.createElement('div');
                bottom.className = 'corner bottom';
                bottom.textContent = `${card.rank}${card.symbol}`;

                cardElement.appendChild(top);
                cardElement.appendChild(center);
                cardElement.appendChild(bottom);
            }

            if (!this.renderedCardIds.has(card.uid)) {
                cardElement.classList.add('card--deal');
                this.renderedCardIds.add(card.uid);
            }

            if (card.revealed && !this.revealedCardIds.has(card.uid)) {
                cardElement.classList.add('card--reveal');
                this.revealedCardIds.add(card.uid);
            }

            return cardElement;
        }

        getHandStatusLabel(hand, index) {
            if (hand.outcome === 'blackjack') return 'Blackjack';
            if (hand.outcome === 'win') return 'Win';
            if (hand.outcome === 'loss') return 'Loss';
            if (hand.outcome === 'push') return 'Push';
            if (hand.status === 'busted') return 'Busted';
            if (hand.status === 'stood') return 'Stand';
            if (hand.status === 'blackjack') return 'Blackjack';

            if (this.phase === 'player_turn') {
                return index === this.currentHandIndex ? 'Your move' : 'Waiting';
            }

            return '';
        }

        getHandTotalText(hand) {
            if (!hand.cards.length || this.phase === 'betting') {
                return 'Total: --';
            }

            const evaluation = this.evaluateHand(hand.cards, { allowBlackjack: !hand.isSplitHand });
            if (evaluation.isBusted) {
                return 'Total: Bust';
            }

            const softLabel = evaluation.isSoft ? ' (soft)' : '';
            return `Total: ${evaluation.total}${softLabel}`;
        }

        getHandTotal(hand) {
            if (!hand || !hand.cards.length || this.phase === 'betting') {
                return '--';
            }

            const evaluation = this.evaluateHand(hand.cards, { allowBlackjack: !hand.isSplitHand });
            return evaluation.isBusted ? 'Bust' : `${evaluation.total}`;
        }

        getDealerDisplayTotal() {
            if (!this.dealerHand.length || this.phase === 'betting') {
                return '--';
            }

            const hasHidden = this.dealerHand.some((card) => card.isHidden);
            if (hasHidden) return '??';

            const evaluation = this.evaluateHand(this.dealerHand, { allowBlackjack: true });
            return `${evaluation.total}`;
        }

        getTotalBet() {
            if (this.phase === 'betting') {
                return this.currentBet;
            }
            return this.playerHands.reduce((sum, hand) => sum + (hand.bet || 0), 0);
        }

        getShoePercent() {
            const total = this.shoe.total();
            if (!total) return 0;
            return Math.round((this.shoe.remaining() / total) * 100);
        }

        wait(ms) {
            return new Promise((resolve) => {
                setTimeout(resolve, ms);
            });
        }
    }

    window.addEventListener('load', () => {
        new BlackjackGame();
    });
})();
