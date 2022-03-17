const { expect } = require( 'chai' );

const ETH = ethers.utils.parseEther( '1.0' );

const BN = ethers.BigNumber;

BN.prototype.neg = function() {
    return BN.from( 0 ).sub( this );
};

describe( 'Lottery', function () {
    const ticketPrice = ETH.mul( 10 );

    //  Default contructor params.
    const OPTIONS = {
        ticketPrice: ticketPrice,

        salesDuration: 7,
        revealDuration: 3,
        endDuration: 1,

        commission: 20,

        value: ticketPrice.mul( 10 ),
    };

    describe( 'deploy', function() {

        it( 'REQ: ticketPrice > 0', async function() {
            const { lottery } = await deployContract( { ticketPrice: 0 } );

            await expect( lottery )
                .to.be.revertedWith( 'REQ: ticketPrice > 0' );
        } );

        it( 'REQ: salesDuration > 0', async function() {
            const { lottery } = await deployContract( { salesDuration: 0 } );

            await expect( lottery )
                .to.be.revertedWith( 'REQ: salesDuration > 0' );
        } );

        it( 'REQ: revealDuration > 0', async function() {
            const { lottery } = await deployContract( { revealDuration: 0 } );

            await expect( lottery )
                .to.be.revertedWith( 'REQ: revealDuration > 0' );
        } );

        it( 'REQ: endDuration > 0', async function() {
            const { lottery } = await deployContract( { endDuration: 0 } );

            await expect( lottery )
                .to.be.revertedWith( 'REQ: endDuration > 0' );
        } );

        it( 'REQ: commission < 100', async function() {
            const { lottery } = await deployContract( { commission: 146 } );

            await expect( lottery )
                .to.be.revertedWith( 'REQ: commission < 100' );
        } );

        it( 'Not enough funds for deposit', async function() {
            const { lottery } = await deployContract( { value: ticketPrice } );

            await expect( lottery )
                .to.be.revertedWith( 'Not enough funds for deposit' );
        } );

        it( 'Owner pays deposit', async function() {
            const deposit = ticketPrice.mul( 10 );

            const { owner, lottery } = await deployContract( { value: deposit } );

            await expect( ( await lottery ).deployTransaction )
                .to.changeEtherBalance( owner, deposit.neg() );
        } );

        it( 'Success', async function() {
            let { lottery } = await deployContract();
            lottery = await lottery;

            await expect( lottery.deployTransaction )
                .to.emit( lottery, 'StartLottery' );
        } );

    } );


    describe( 'buyTicket', function() {

        it( 'Pay for a ticket', async function() {
            let { lottery } = await deployContract();
            lottery = await lottery;

            const buyer = await getContact( 1 );

            const tx = lottery.connect( buyer ).buyTicket( 0, { value: ticketPrice } );
            await expect( await tx )
                .changeEtherBalance( buyer, ticketPrice.neg() );
        } );

        it( 'Lottery received ticket price', async function() {
            let { lottery } = await deployContract();
            lottery = await lottery;

            const buyer = await getContact( 1 );

            const tx = lottery.connect( buyer ).buyTicket( 0, { value: ticketPrice } );
            await expect( await tx )
                .changeEtherBalance( lottery, ticketPrice );
        } );

        it( 'Not enough funds to buy a ticket', async function() {
            let { lottery } = await deployContract();
            lottery = await lottery;

            const buyer = await getContact( 1 );

            const tx = lottery.connect( buyer ).buyTicket( 0, { value: ETH } );
            await expect( tx )
                .to.be.revertedWith( 'Not enough funds to buy a ticket' );
        } );

        it( 'No more ticket sales', async function() {
            let { lottery } = await deployContract();
            lottery = await lottery;

            const buyer = await getContact( 1 );

            await sleepDays( OPTIONS.salesDuration + 1 );

            const tx = lottery.connect( buyer ).buyTicket( 0, { value: ticketPrice } );
            await expect( tx )
                .to.be.revertedWith( 'No more ticket sales' );
        } );

        it( 'Success', async function() {
            let { lottery } = await deployContract();
            lottery = await lottery;

            const buyer = await getContact( 1 );

            const tx = lottery.connect( buyer ).buyTicket( 0, { value: ticketPrice } );
            await expect( tx )
                .to.emit( lottery, 'BuyTicket' )
                .withArgs( buyer.address );
        } );

    } );


    describe( 'revealSecret', function() {

        it( 'It\'s too early to reveal', async function() {
            let { lottery } = await deployContract();
            lottery = await lottery;

            const buyer = await getContact( 1 );

            const secret = 2762;
            const hashedSecret = hashIt( secret );

            await lottery.connect( buyer ).buyTicket( hashedSecret, { value: ticketPrice } );

            const tx = lottery.connect( buyer ).revealSecret( secret );
            await expect( tx )
                .to.be.revertedWith( 'It\'s too early to reveal' );
        } );

        it( 'No more reveals', async function() {
            let { lottery } = await deployContract();
            lottery = await lottery;

            const buyer = await getContact( 1 );

            const secret = 2762;
            const hashedSecret = hashIt( secret );

            await lottery.connect( buyer ).buyTicket( hashedSecret, { value: ticketPrice } );

            await sleepDays( OPTIONS.salesDuration + OPTIONS.revealDuration );

            const tx = lottery.connect( buyer ).revealSecret( secret );
            await expect( tx )
                .to.be.revertedWith( 'No more reveals' );
        } );

        it( 'No ticket', async function() {
            let { lottery } = await deployContract();
            lottery = await lottery;

            const buyer = await getContact( 1 );

            await sleepDays( OPTIONS.salesDuration + 1 );

            const tx = lottery.connect( buyer ).revealSecret( 0 );
            await expect( tx )
                .to.be.revertedWith( 'No ticket' );
        } );

        it( 'Secret doesn\'t match stored hash', async function() {
            let { lottery } = await deployContract();
            lottery = await lottery;

            const buyer = await getContact( 1 );

            const secret = 2762;
            const hashedSecret = hashIt( secret );

            await lottery.connect( buyer ).buyTicket( hashedSecret, { value: ticketPrice } );

            await sleepDays( OPTIONS.salesDuration + 1 );

            const tx = lottery.connect( buyer ).revealSecret( 1337 );
            await expect( tx )
                .to.be.revertedWith( 'Secret doesn\'t match stored hash' );
        } );

        it( 'Success', async function() {
            let { lottery } = await deployContract();
            lottery = await lottery;

            const buyer = await getContact( 1 );

            const secret = 2762;
            const hashedSecret = hashIt( secret );

            await lottery.connect( buyer ).buyTicket( hashedSecret, { value: ticketPrice } );

            await sleepDays( OPTIONS.salesDuration );

            const tx = lottery.connect( buyer ).revealSecret( secret );
            await expect( await tx )
                .to.emit( lottery, 'RevealSecret' )
                .withArgs( buyer.address );
        } );

    } );


    describe( 'endLottery', function() {

        it( 'Ownable: caller is not the owner', async function() {
            let { lottery } = await deployContract();
            lottery = await lottery;

            const buyer = await getContact( 1 );

            const tx = lottery.connect( buyer ).endLottery( 0 );
            await expect( tx )
                .to.be.revertedWith( 'Ownable: caller is not the owner' );
        } );

        it( 'Lottery is still in progress', async function() {
            let { owner, lottery } = await deployContract();
            lottery = await lottery;

            const tx = lottery.connect( owner ).endLottery( 0 );
            await expect( tx )
                .to.be.revertedWith( 'Lottery is still in progress' );
        } );

        it( 'It\'s too late to end the lottery', async function() {
            let { owner, lottery } = await deployContract();
            lottery = await lottery;

            await sleepDays( OPTIONS.salesDuration + OPTIONS.revealDuration + OPTIONS.endDuration );

            const tx = lottery.connect( owner ).endLottery( 0 );
            await expect( tx )
                .to.be.revertedWith( 'It\'s too late to end the lottery' );
        } );

        it( 'Secret doesn\'t match stored hash', async function() {
            let { owner, lottery } = await deployContract();
            lottery = await lottery;

            await sleepDays( OPTIONS.salesDuration + OPTIONS.revealDuration );

            const tx = lottery.connect( owner ).endLottery( 0 );
            await expect( tx )
                .to.be.revertedWith( 'Secret doesn\'t match stored hash' );
        } );

        it( 'Success', async function() {
            let { owner, ownersSecret, lottery } = await deployContract();
            lottery = await lottery;

            const contacts = await getContacts();

            let rnd = BN.from( 0 );

            const nTickets = 4;
            const secrets = [];

            for ( let i = 1; i <= nTickets; i++ ) {
                const secret = BN.from( 1000 + i );
                secrets[ i ] = secret;
                const hashedSecret = hashIt( secret );

                await lottery.connect( contacts[ i ] ).buyTicket( hashedSecret, { value: ticketPrice } );

            }

            await sleepDays( OPTIONS.salesDuration );

            //  One ticket wasn't revealed.
            const nRevealedTickets = nTickets - 1;
            for ( let i = 1; i <= nRevealedTickets; i++ ) {
                await lottery.connect( contacts[ i ] ).revealSecret( secrets[ i ] );

                //  Only revealed secrets used for rnd.
                rnd = BN.from( ethers.utils.solidityKeccak256( [ 'uint256', 'uint256' ], [ secrets[ i ], rnd ] ) );
            }
            rnd = BN.from( ethers.utils.solidityKeccak256( [ 'uint256', 'uint256' ], [ ownersSecret, rnd ] ) );

            await sleepDays( OPTIONS.revealDuration );

            //  Contact 0 is a owner, so we have to add 1 here.
            const winnerIndex = rnd.mod( nRevealedTickets ).toNumber() + 1;
            const winner = contacts[ winnerIndex ];

            const prize = ticketPrice.mul( nTickets ).mul( 100 - OPTIONS.commission ).div( 100 );
            const commission = ticketPrice.mul( nTickets ).mul( OPTIONS.commission ).div( 100 );

            const tx = lottery.connect( owner ).endLottery( ownersSecret );

            await expect( tx )
                .to.emit( lottery, 'EndLottery' )
                .withArgs( winner.address, prize );

            await expect( await tx )
                //  Winner gets his prize and owner gets commission + deposit.
                .changeEtherBalances( [ winner, owner ], [ prize, commission.add( OPTIONS.value ) ] );
        } );

    } );


    describe( 'returnTicket', function() {

        it( 'No ticket', async function() {
            let { lottery } = await deployContract();
            lottery = await lottery;

            const buyer = await getContact( 1 );

            await sleepDays( OPTIONS.salesDuration + OPTIONS.revealDuration + OPTIONS.endDuration );

            //  We're trying to return ticket without buying it first.
            const tx = lottery.connect( buyer ).returnTicket( 0 );
            await expect( tx )
                .to.be.revertedWith( 'No ticket' );
        } );

        it( 'Secret doesn\'t match stored hash', async function() {
            let { lottery } = await deployContract();
            lottery = await lottery;

            const buyer = await getContact( 1 );
            const secret = 2762;
            const hashedSecret = hashIt( secret );

            await lottery.connect( buyer ).buyTicket( hashedSecret, { value: ticketPrice } );

            await sleepDays( OPTIONS.salesDuration + OPTIONS.revealDuration + OPTIONS.endDuration );

            const tx = lottery.connect( buyer ).returnTicket( 0 );
            await expect( tx )
                .to.be.revertedWith( 'Secret doesn\'t match stored hash' );
        } );

        it( 'It\'s too early to return tickets', async function() {
            let { owner, ownersSecret, lottery } = await deployContract();
            lottery = await lottery;

            const buyer = await getContact( 1 );

            const tx = lottery.connect( buyer ).returnTicket( 0 );
            await expect( tx )
                .to.be.revertedWith( 'It\'s too early to return tickets' );
        } );

        it( 'Success', async function() {
            let { lottery } = await deployContract();
            lottery = await lottery;

            const buyer = await getContact( 1 );
            const secret = 2762;
            const hashedSecret = hashIt( secret );

            await lottery.connect( buyer ).buyTicket( hashedSecret, { value: ticketPrice } );

            await sleepDays( OPTIONS.salesDuration + OPTIONS.revealDuration + OPTIONS.endDuration );

            const tx = lottery.connect( buyer ).returnTicket( secret );

            await expect( tx )
                .to.emit( lottery, 'ReturnTicket' )
                .withArgs( buyer.address );

            await expect( await tx )
                .changeEtherBalance( buyer, ticketPrice );
        } );

    } );

    /*
    async function printBalance() {
        const signers = await ethers.getSigners();

        for ( let i = 0; i < signers.length; i++ ) {
            const address = signers[ i ].address;
            const balance = await getBalance( address );

            console.log( address, balance.toString() );
        }
    }
    */

    //  Helpers.

    async function getContacts() {
        return ethers.getSigners();
    }

    async function getContact( i ) {
        const signers = await getContacts();

        return signers[ i ];
    }

    async function getBalance( address ) {
        return ethers.provider.getBalance( address );
    }

    async function deployContract( options ) {
        options = {
            ...OPTIONS,
            ...options,
        };

        const ownersSecret = BN.from( 1337 );
        const hashedOwnersSecret = hashIt( ownersSecret );

        const signers = await ethers.getSigners();
        const owner = signers[ 0 ];

        const Lottery = await ethers.getContractFactory( 'Lottery', owner );
        const lottery = Lottery.deploy(
            options.ticketPrice,
            options.salesDuration,
            options.revealDuration,
            options.endDuration,
            options.commission,
            hashedOwnersSecret,
            { value: options.value },
        );

        return { owner, ownersSecret, hashedOwnersSecret, lottery, signers };
    }

} );

function hashIt( s ) {
    return BN.from( ethers.utils.solidityKeccak256( [ 'uint256' ], [ s ] ) );
}

async function sleepDays( days ) {
    await ethers.provider.send( 'evm_increaseTime', [ days * 86400 ] );
    await ethers.provider.send( 'evm_mine' );
}

