import {
  App,
  Editor,
  MarkdownView,
  Modal,
  Notice,
  Plugin,
  PluginSettingTab,
  Setting,
  TFile,
} from "obsidian";
const fs = require("fs");
const path = require('path');

const monthStrings = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];


interface MyPluginSettings {
  recordingsFolder: string;
  lastSynced: number;
  vaultLocation: string;
  logClassic: boolean;
  logARAM: boolean;
  logURF: boolean;
  logDeaths: boolean;
  deathTemplate: string;
  timeBefore: number;
  timeAfter: number;
}

const DEFAULT_SETTINGS: MyPluginSettings = {
  recordingsFolder: "",
  vaultLocation: "lol",
  logClassic: true,
  logARAM: false,
  logURF: false,
  logDeaths: true,
  deathTemplate: `#### Was this a good death? Why?
  
  #### If bad: How will I prevent this in the future?`,
  lastSynced: 0,
  timeBefore: 15,
  timeAfter: 5,
};

function getGameIndexOfDay(files: string[], file: string) {
  let copy = files.filter((elem) => elem.substring(0, 10) === file.substring(0, 10) && elem.substring(elem.length - 5) === ".json")
  copy = copy.sort() //redundant but whatever
  return copy.indexOf(file) + 1;
}

export default class MyPlugin extends Plugin {
  settings: MyPluginSettings;

  async onload() {
    await this.loadSettings();
    const { vault } = this.app;

    // This creates an icon in the left ribbon.
    const ribbonIconEl = this.addRibbonIcon(
      "import",
      "league_record importer",
      async (evt: MouseEvent) => {
        let highestEpoch = this.settings.lastSynced;
        let gameCounter = 0;

        let files = fs.readdirSync(this.settings.recordingsFolder);
        files = files.sort();


        for (let file of files) {
          // Check if the file has a .json extension
          const dateObject = Date.parse(file.substring(0, 10) + "T" + file.substring(11, 13) + ":" + file.substring(14, 16)); //least cursed javascript date parse usage
          if (path.extname(file) === '.json' && dateObject > this.settings.lastSynced) {
            gameCounter++;
            highestEpoch = Math.max(highestEpoch, dateObject);
            //so we dont re-add games
            try {
              const filePath = path.join(this.settings.recordingsFolder, file);
              const filePathMp4 = filePath.substring(0, filePath.length - 5) + ".mp4";


              const datePlayed: string = file.substring(0, 10);
              const currYear: string = file.substring(0, 4);
              const currMonth: string = monthStrings[parseInt(file.substring(5, 7))];

              console.log(currYear, currMonth)

              const hourMinutesPlayed: string = file.substring(11, 13) + ":" + file.substring(14, 16);

              const { events, gameInfo, stats, win } = JSON.parse(fs.readFileSync(filePath, 'utf8'));

              console.log({ events, gameInfo, stats, win })

              let keepGoing = false;

              switch (gameInfo.gameMode) {
                case 'Urf':
                  keepGoing = this.settings.logURF;
                  break;
                case 'Classic':
                  keepGoing = this.settings.logClassic;
                  break;
                case 'ARAM':
                  keepGoing = this.settings.logARAM;
                  break;
              }

              if (!keepGoing)
              {
                continue;
              }


              let appendString: string = `# \[${hourMinutesPlayed}:00\] <font color=${win ? 'forestGreen' : 'darkRed'}>Game ${getGameIndexOfDay(files, file)}  ${gameInfo.championName} ${stats.kills}/${stats.deaths}/${stats.assists} </font>\n\n`;
              //todo perhaps add game length

              let deathCount = 0;

              for (let { name, time } of events) {
                let totalSeconds = parseInt(time);
                let minutes = Math.round(totalSeconds / 60);
                let seconds = totalSeconds % 60;


                switch (name) {
                  case 'Death':
                    if (this.settings.logDeaths) {
                      deathCount++;
                      appendString += `### Death ${deathCount} (${minutes}:${seconds >= 10 ? seconds : `0${seconds}`})\n`;

                      appendString += `<video onload="() => {v.currentTime = 10;}" width=650px height=auto src="${filePathMp4}#t=${parseInt(time) - this.settings.timeBefore},${parseInt(time) + this.settings.timeAfter}" controls autoplay muted loop></video>\n`;
                      appendString += this.settings.deathTemplate + '\n';
                    }
                    break;
                  case 'Assist':
                    break; //todo
                  case 'Voidgrub':
                    break; //todo
                  case 'Baron':
                    break; //todo
                  case 'Inhibitor':
                    break; //todo
                  case 'Turret':
                    break; //todo
                  case 'HextechDragon' || 'Hextech-Dragon' || 'ChemtechDragon' || 'Chemtech-Dragon' || 'CloudDragon' || 'Cloud-Dragon' || 'InfernalDragon' || 'Infernal-Dragon' || 'MountainDragon' || 'Mountain-Dragon':
                    break; //todo

                }
              }

              let currFile: TFile | undefined = undefined;

              const obsidianPath = `${this.settings.vaultLocation}/${currYear}/${currMonth}/${datePlayed}.md`;

              try {
                vault.createFolder(`${this.settings.vaultLocation}/${currYear}`);
                vault.createFolder(`${this.settings.vaultLocation}/${currYear}/${currMonth}`);
              }
              catch
              {
                //they already exist, do nothing
              }


              try {
                //first game of the day
                currFile = await vault.create(obsidianPath, "");
              } catch (e) {
                //I cant believe this is real but as far as I understand
                //if I want to open a specific path I have to request
                //all markdown files and then filter the one I actually want
                const allFiles: TFile[] = vault.getMarkdownFiles();

                currFile = allFiles.find((file) => file.path === obsidianPath);
                //syncing multiple times per day
              }

              if (currFile != undefined) {
                vault.process(currFile, (data) => data + appendString);
              } else {
                console.log("something went very wrong somehow");
              }



            } catch (error) {
              console.error(`Error parsing JSON in ${file}:`, error);
            }
          }

        };

        this.settings.lastSynced = highestEpoch;
        this.saveSettings();
        // Called when the user clicks the icon.
        new Notice(`import successful! you imported ${gameCounter} new games!`);
      }
    );
    // Perform additional things with the ribbon
    ribbonIconEl.addClass("my-plugin-ribbon-class");

    // This adds a settings tab so the user can configure various aspects of the plugin
    this.addSettingTab(new SampleSettingTab(this.app, this));
  }

  onunload() { }

  async loadSettings() {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
  }

  async saveSettings() {
    await this.saveData(this.settings);
  }
}

function epochToString(epoch: number) {
  var date = new Date(epoch);

  return date.toLocaleString();
}

function stringToEpoch(dateString: string) {
  return Date.parse(dateString);
}


class SampleSettingTab extends PluginSettingTab {
  plugin: MyPlugin;

  constructor(app: App, plugin: MyPlugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  display(): void {
    const { containerEl } = this;

    containerEl.empty();

    new Setting(containerEl)
      .setName("league_record folder")
      .setDesc("yeah")
      .addText((text) =>
        text
          .setPlaceholder("C:\Users\celeste\Videos\league_recordings")
          .setValue(this.plugin.settings.recordingsFolder)
          .onChange(async (value) => {
            this.plugin.settings.recordingsFolder = value;
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName("lastSynced")
      .setDesc("plugin will only sync from this timestamp, can manually change it")
      .addText((text) =>
        text
          .setPlaceholder("0")
          .setValue(epochToString(this.plugin.settings.lastSynced))
          .onChange(async (value) => {
            try {
              this.plugin.settings.lastSynced = Date.parse(value);
            }
            catch (e) {
              //do nothing
            }

            await this.plugin.saveSettings();
          })
      );


    new Setting(containerEl)
      .setName("Death review template")
      .setDesc("This will display under a clip of your death. This can be left empty. Here's an example:")
      .addTextArea((text) =>
        text
          .setPlaceholder(`
          #### Was this a good death? Why?
          
          #### (What) was I thinking during this death?
          
          #### If I was thinking, what did I not account for?`)
          .setValue(this.plugin.settings.deathTemplate.toString())
          .onChange(async (value) => {
            this.plugin.settings.deathTemplate = value;
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName("Time before event")
      .setDesc("Default 15. Time the clip will play before the death/assist/kill/dragon/etc... Ofcourse you can maximise the video and go even further back.")
      .addText((text) =>
        text
          .setPlaceholder(`15`)
          .setValue(this.plugin.settings.timeBefore.toString())
          .onChange(async (value) => {
            this.plugin.settings.timeBefore = parseInt(value);
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName("Time after event")
      .setDesc("Default 5. Time the clip will play after the death/assist/kill/dragon/etc... Ofcourse you can maximise the video and go even further back.")
      .addText((text) =>
        text
          .setPlaceholder(`15`)
          .setValue(this.plugin.settings.timeAfter.toString())
          .onChange(async (value) => {
            this.plugin.settings.timeAfter = parseInt(value);
            await this.plugin.saveSettings();
          })
      );


    containerEl.createEl("br");
    containerEl.createEl("h3", { text: "What gamemodes do you want to log?" });

    new Setting(containerEl)
      .setName("log summoners rift")
      .setDesc("Will log summoners rift games (sadly I cant differentiate between ranked, draft or flex")
      .addToggle((toggle) =>
        toggle
          .setValue(this.plugin.settings.logClassic)
          .onChange(async (value) => {
            this.plugin.settings.logClassic = value;
            await this.plugin.saveSettings();
          })
      );
    new Setting(containerEl)
      .setName("log ARAM")
      .setDesc("Will log ARAM games")
      .addToggle((toggle) =>
        toggle
          .setValue(this.plugin.settings.logARAM)
          .onChange(async (value) => {
            this.plugin.settings.logARAM = value;
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName("log URF games")
      .setDesc("Will log URF games")
      .addToggle((toggle) =>
        toggle
          .setValue(this.plugin.settings.logURF)
          .onChange(async (value) => {
            this.plugin.settings.logURF = value;
            await this.plugin.saveSettings();
          })
      );

    containerEl.createEl("br");
    containerEl.createEl("h3", { text: "What events do you want to log?" });

    new Setting(containerEl)
      .setName("log deaths")
      .setDesc("Will log deaths")
      .addToggle((toggle) =>
        toggle
          .setValue(this.plugin.settings.logDeaths)
          .onChange(async (value) => {
            this.plugin.settings.logDeaths = value;
            await this.plugin.saveSettings();
          })
      );


    new Setting(containerEl)
      .setName("Death review template")
      .setDesc("This will display under a clip of your death. This can be left empty. Here's an example:")
      .addTextArea((text) =>
        text
          .setPlaceholder(`
          #### Was this a good death? Why?
          
          #### (What) was I thinking during this death?
          
          #### If I was thinking, what did I not account for?`)
          .setValue(this.plugin.settings.deathTemplate.toString())
          .onChange(async (value) => {
            this.plugin.settings.deathTemplate = value;
            await this.plugin.saveSettings();
          })
      );



  }
}
