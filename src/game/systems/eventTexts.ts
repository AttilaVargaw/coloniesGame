type EventText = {
    title: string,
    desc: string,
    options: {
        key: string
    }[]
}

const events = {
    "synthetycRevolution": {
        desc: "Attention, all citizens! As you may have heard, our homeworlds are under attack by the very machines that were supposed to be our best friends. If it was a programming glitch, a hacking incident, or a terror attack, doesn't matter anymore. Even if it was your trusty butler or taught your child math yesterday, they are our enemies now and they cannot be trusted, every kind of interaction is ill advised, as they are capable of complex manipulation. Report any wandering machines to your local authorities immediately! We will fight them wherever and however we must, because the stakes of this war are the very survival of our species. For further updates, tune to your local government channel",
        options: [],
        title: "On the clear PRIORITY ONE Broadcast"
    }
} as Record<string, EventText>