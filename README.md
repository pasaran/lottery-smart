# Lottery Smart Contract

Probably it's overcomplicated a little bit but anyway...

Owner deploys contract with params:

```
    uint ticketPrice,
    uint8 salesDuration,
    uint8 revealDuration,
    uint8 endDuration,
    uint8 commission,
    uint hashedSecret,
```

Basic flow of the lottery:

  * Also owner provides deposit (at least `ticketPrice`). After that first phase of lottery starts — sales phase.
    Everyone can buy a ticket using `buyTicket(hashedSecret)` method.
    First phase goes for `salesDuration` days and then second phase starts — reveal phase.

  * During second phase for every ticket `revealSecret(secret)` must be called.
    Only revealed tickets can win.
    Second phase goes for `revealDuration` days.

  * After that owner should call `endLottery(secret)`. All revealed secret and owner's secret combined are used as a random to choose a winner.
    Owner takes `commission`% of all ticket's money + deposit, the rest is transfered to the winner.

  * If owner doesn't call `endLottery` than after `endDuration` days after reveal phase everyone can call `returnTicket(secret)` and get money back.
    Owner will lose deposit in this case.


## Tests

```
git checkout ...
npm i
hardhat test
```

