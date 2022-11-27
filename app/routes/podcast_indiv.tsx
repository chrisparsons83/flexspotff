//Clean up the shownotes formating
function cleanShowNotes (showNotes : string) {
    //Create a dict
    let description = "";
  
    //Find the description
    //If the description is wrapped in <p>, extract it and remove the tags
    if (showNotes[0] === '<') {
      let originalDesciption = showNotes.match(/<(.)>.*?<\/\1>/g);
      if (originalDesciption) {
        description = originalDesciption[0].slice(3, -4);
      }
      //Find any additional links using href
      let additionalLinks = showNotes.match(/(?<=<a href=)(.*?)(?=<\/a>)/g);
  
      //Links to remove
      const conditions = ["bootzfantasy", "BootzFantasy", "Drtrashdad", "drtrashdad", "discord.gg"];
      let condensedAdditionalLinks = [];
      if (additionalLinks) {
        for(const key in additionalLinks) {
            if (!(conditions.some(el => additionalLinks[key].includes(el)))) {
              //Seperate the Link from the text
              let splitArray = additionalLinks[key].split("'");
              let link = splitArray[1];
              let text = splitArray[2].split(">").pop();
              condensedAdditionalLinks.push({
                "link" : link,
                "text" : text
              });
            }
        }
      }
  
      return {
        "description": description,
        "additionalLinks": condensedAdditionalLinks
      };
    }
    //Else the entrie text is the description
    else {
      //Remove Twitter Links
      showNotes.replace("https://twitter.com/bootzfantasy", "");
      showNotes.replace("https://twitter.com/BootzFantasy", "");
      showNotes.replace("https://twitter.com/Drtrashdad", "");
      showNotes.replace("https://twitter.com/drtrashdad", "");
  
      return {
        "description": description,
        "additionalLinks": [{
          "link": "",
          "text": ""
        }]
      }
    }
  }
  
  export default function Index() {
  
    let showNotes = "<p>We've brought in ChrisThrowsRocks as a special guest for this special episode where we tackle one of the most interesting formats in fantasy. \
    Through this epic of an episode they tackle player takes, tournament formats and how to attack them, and Chris live tilting. \
    Join us as we attempt to take down a massive tournament with a top prize of over $500,000.</p> <p> \
    <a href='https://myffpc.com/FFPCDraftBoard.aspx?refid=B43-0B9E819C56CB&refid=B43-0B9E819C56CB'>Draft Board</a></p> <p>Our links:</p> <ul> <li> \
    <a href='https://twitter.com/BootzFantasy'>https://twitter.com/BootzFantasy</a></li> <li><a href='https://discord.gg/GZ9ZYYE'>https://discord.gg/GZ9ZYYE</a></li> \
     </ul> <p>Referenced Material</p> <ul> <li><a href='https://twitter.com/AdamHarstad/status/1561393756674281472?s=20&t=IqaDLLwlTA6QQuWWL2KaxQ'SS>Adam Harstad twitter \
     thread about being wrong</a></li> </ul>"
  
    let showNotes2 = "Bootz and ikyn are back and drafting a Best Ball Mania team on Underdog fantasy to win over $2,000,000. Despite ikyns best efforts to draft a well rounded balanced team, Bootz simply demands to go 0rb. Along their journey they discuss their player takes, ceiling outcomes, and if there is any real meaning to life or if we are all just sims a cruel teenagers SIMS game. Join us as we dive into Best Ball, avoiding our real life responsibilities, and general refusal to draft a single player over the age of 28. https://twitter.com/bootzfantasy https://twitter.com/drtrashdad"
  
    return (
      <>
      <h2>Special: FFPC Draft With ChrisThrowsRocks</h2>
  
      <p className="my-1 font-semibold" >8/28/2022</p>
  
      <p className="pb-4">
      {cleanShowNotes(showNotes)["description"]}
      </p>
  
      {cleanShowNotes(showNotes)["additionalLinks"].map((resource) => (
        <>
          <h3 className="mb-0">{resource.text}</h3>
          <p>{resource.link}</p>
        </>
        ))}
  
      <audio controls>
        <source src="/ep1.mp3" type="audio/mpeg">
        </source>
      </audio>
  
      </>
    );
  }
  