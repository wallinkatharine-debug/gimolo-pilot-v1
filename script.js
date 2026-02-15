
const activities = [];

for (let i = 1; i <= 370; i++) {
  activities.push({
    title: "Activity " + i,
    desc: "This is description for activity " + i
  });
}

let currentActivity = null;

const spinScreen = document.getElementById("spinScreen");
const activityScreen = document.getElementById("activityScreen");
const progressScreen = document.getElementById("progressScreen");

const wheel = document.getElementById("wheel");
const activityTitle = document.getElementById("activityTitle");
const activityDesc = document.getElementById("activityDesc");
const progressTitle = document.getElementById("progressTitle");
const progressFill = document.getElementById("progressFill");

wheel.onclick = () => {
  const randomIndex = Math.floor(Math.random() * activities.length);
  currentActivity = activities[randomIndex];

  activityTitle.innerText = currentActivity.title;
  activityDesc.innerText = currentActivity.desc;

  spinScreen.classList.remove("active");
  activityScreen.classList.add("active");
};

document.getElementById("spinAgainBtn").onclick = () => {
  spinScreen.classList.add("active");
  activityScreen.classList.remove("active");
};

document.getElementById("startBtn").onclick = () => {
  progressTitle.innerText = currentActivity.title;

  spinScreen.classList.remove("active");
  activityScreen.classList.remove("active");
  progressScreen.classList.add("active");

  let width = 0;
  const interval = setInterval(() => {
    if (width >= 100) {
      clearInterval(interval);
    } else {
      width++;
      progressFill.style.width = width + "%";
    }
  }, 20);
};

document.getElementById("doneBtn").onclick = () => {
  progressScreen.classList.remove("active");
  spinScreen.classList.add("active");
  progressFill.style.width = "0%";
};

document.getElementById("backBtn").onclick = () => {
  progressScreen.classList.remove("active");
  spinScreen.classList.add("active");
};
