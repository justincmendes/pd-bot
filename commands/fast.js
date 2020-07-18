module.exports.run = async (bot, message, args) => {
    let usageMessage = "\`USAGE:\n?fast <ACTION>\n ACTION: start; end; see => past <#_OF_ENTRIES>, all\`";

    if(args = undefined || args.length == 0)
    {
        message.channel.send(usageMessage);
    }
    // switch(args[0])
    // {
    //     case "start":
    //         if()
    //     break;
    //     case "end":
    //         if()
    //     break;
    //     case "see":
    //         if()
    //     break;
    //     default:
    //         message.channel.send(usageMessage);
    // }
}

module.exports.help = {
    name: "fast"
}