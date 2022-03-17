pragma solidity ^0.8.0;

import "@openzeppelin/contracts/access/Ownable.sol";

// import "hardhat/console.sol";

contract Lottery is Ownable {
    uint private _deposit;
    uint private _ticketPrice;
    uint8 private _commission;

    //  After this date there are no more ticket sales.
    uint private _salesEnd;
    //  By this time every ticket owner must provide ticket's secret.
    uint private _revealEnd;
    //  By that time owner must end lottery.
    //  Otherwise owner will lost deposit and all tickets can be returned back.
    uint private _endEnd;

    uint private _ownersHashedSecret;

    //  address -> secret's hash
    mapping (address => uint) private _tickets;

    address[] private _revealedAddresses;

    uint private _rnd;

    event StartLottery();
    event BuyTicket(address addr);
    event RevealSecret(address addr);
    event ReturnTicket(address addr);
    event EndLottery(address winner, uint prize);

    constructor(
        //  Price of a ticket.
        uint ticketPrice,

        //  Duration of sales period in days.
        uint8 salesDuration,
        //  Duration of reveal period in days.
        uint8 revealDuration,
        //  After reveal phase owner must end lottery in endDuration days.
        uint8 endDuration,

        //  Commission of the owner in % (0 <= commission < 100).
        uint8 commission,

        //  Owner's hashed secret.
        uint ownersHashedSecret
    )
        payable
    {
        require(ticketPrice > 0, "REQ: ticketPrice > 0");

        //  Owner must provide deposit to start a lottery.
        //  Deposit must be greater than ticketPrice.
        require(msg.value > ticketPrice, "Not enough funds for deposit");
        _deposit = msg.value;

        require(salesDuration > 0, "REQ: salesDuration > 0");
        require(revealDuration > 0, "REQ: revealDuration > 0");
        require(endDuration > 0, "REQ: endDuration > 0");
        require(commission < 100, "REQ: commission < 100");

        _ticketPrice = ticketPrice;

        uint salesEnd = block.timestamp + salesDuration * 1 days;
        _salesEnd = salesEnd;
        uint revealEnd = salesEnd + revealDuration * 1 days;
        _revealEnd = revealEnd;
        _endEnd = revealEnd + endDuration * 1 days;

        _commission = commission;
        _ownersHashedSecret = ownersHashedSecret;

        emit StartLottery();
    }


    //  To buy a ticket user must provide a hash of a secret
    //  that will be used in reveal phase.
    //
    function buyTicket(uint hashedSecret) public payable {
        require(msg.value >= _ticketPrice, "Not enough funds to buy a ticket");
        require(block.timestamp <= _salesEnd, "No more ticket sales");

        address addr = msg.sender;
        _tickets[addr] = hashedSecret;

        emit BuyTicket(addr);
    }


    //  After sales end all user must reveal their secrets.
    function revealSecret(uint secret) public {
        require(block.timestamp > _salesEnd, "It's too early to reveal");
        require(block.timestamp <= _revealEnd, "No more reveals");

        address addr = msg.sender;

        uint hashedSecret = _tickets[addr];
        require(hashedSecret != 0, "No ticket");
        require(uint(keccak256(abi.encode(secret))) == hashedSecret, "Secret doesn't match stored hash");

        //  Accumulate random from all revealed secrets.
        _rnd = uint(keccak256(abi.encode(secret, _rnd)));

        _revealedAddresses.push(addr);

        emit RevealSecret(addr);
    }


    //  Now owner must provide secret too.
    function endLottery(uint secret) public onlyOwner {
        require(block.timestamp > _revealEnd, "Lottery is still in progress");
        require(block.timestamp <= _endEnd, "It's too late to end the lottery");
        require(uint(keccak256(abi.encode(secret))) == _ownersHashedSecret, "Secret doesn't match stored hash");

        uint n = _revealedAddresses.length;
        if (n > 0) {
            //  Final random.
            uint rnd = uint(keccak256(abi.encode(secret, _rnd)));
            address winner = _revealedAddresses[rnd % n];

            uint prizeFund = address(this).balance - _deposit;
            uint prize = prizeFund * ( 100 - _commission ) / 100;

            payTo(winner, prize);

            emit EndLottery(winner, prize);
        }

        //  Collect remaining balance back (deposit, commission and unrevealed tickets).
        selfdestruct(payable(owner()));
    }


    //  If owner didn't end lottery in time ticket could be returned back.
    function returnTicket(uint secret) public {
        require(block.timestamp > _endEnd, "It's too early to return tickets");

        address addr = msg.sender;

        uint hashedSecret = _tickets[addr];
        require(hashedSecret != 0, "No ticket");
        require(uint(keccak256(abi.encode(secret))) == hashedSecret, "Secret doesn't match stored hash");

        payTo(addr, _ticketPrice);

        emit ReturnTicket(addr);
    }


    function payTo(address to, uint amount) private {
        payable(to).transfer(amount);
    }

}

