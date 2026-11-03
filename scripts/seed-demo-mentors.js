require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../models/User');
const connectDB = require('../config/database');

const DEMO_PASSWORD = 'MentorConnectDemo2026';
const DEMO_EMAIL_PREFIX = 'mentorlink.demo';

const DEMO_USERS = [
  ['Aarav Kulkarni', 4, 'COMPS', 'offering', 'flexible', ['Python', 'Machine Learning', 'SQL', 'Pandas'], ['AI', 'Data Analytics'], 'Built a fictional demo fraud-detection dashboard and completed a fictional demo ML mentorship cohort.', 'Aarav'],
  ['Meera Shah', 4, 'CSE', 'offering', 'weekends', ['Java', 'Data Structures', 'Competitive Programming', 'Git'], ['Algorithms', 'Technical Interviews'], 'Placed in a fictional demo coding challenge and led a fictional demo algorithms study group.', 'Meera'],
  ['Rohan Iyer', 4, 'IT', 'offering', 'flexible', ['JavaScript', 'React', 'Node.js', 'MongoDB'], ['Web Development', 'Product Engineering'], 'Created a fictional demo full-stack campus marketplace and contributed to a fictional demo open-source sprint.', 'Rohan'],
  ['Anika Deshpande', 4, 'ECE', 'offering', 'weekdays', ['C', 'Embedded Systems', 'Arduino', 'PCB Design'], ['IoT', 'Hardware Design'], 'Designed a fictional demo environmental sensor and presented it at a fictional demo electronics workshop.', 'Anika'],
  ['Vihaan Patil', 4, 'CSE', 'offering', 'flexible', ['Python', 'Generative AI', 'NLP', 'FastAPI'], ['Artificial Intelligence', 'Research'], 'Prototyped a fictional demo document assistant and wrote a fictional demo technical research report.', 'Vihaan'],
  ['Ishita Rao', 4, 'IT', 'offering', 'weekends', ['SQL', 'Power BI', 'Python', 'Data Visualization'], ['Data Analytics', 'Business Intelligence'], 'Built a fictional demo placement analytics dashboard and facilitated a fictional demo data workshop.', 'Ishita'],
  ['Kabir Joshi', 4, 'COMPS', 'offering', 'flexible', ['Java', 'Spring Boot', 'SQL', 'System Design'], ['Software Engineering', 'Backend Development'], 'Delivered a fictional demo microservices project and completed a fictional demo backend design review.', 'Kabir'],
  ['Nandini Menon', 4, 'CSE', 'both', 'weekends', ['Figma', 'UI/UX Design', 'React', 'User Research'], ['Product Design', 'Accessibility'], 'Designed a fictional demo student-services prototype and organized a fictional demo design critique.', 'Nandini'],
  ['Samar Khan', 4, 'IT', 'offering', 'flexible', ['AWS', 'Docker', 'Linux', 'Python'], ['Cloud Computing', 'DevOps'], 'Deployed a fictional demo containerized API and completed a fictional demo cloud operations lab.', 'Samar'],
  ['Piya Nair', 4, 'EXTC', 'offering', 'weekdays', ['C++', 'Digital Electronics', 'Verilog', 'Embedded Systems'], ['VLSI', 'Robotics'], 'Built a fictional demo line-following controller and presented a fictional demo hardware poster.', 'Piya'],
  ['Dev Malhotra', 3, 'COMPS', 'offering', 'flexible', ['Python', 'Machine Learning', 'SQL', 'Scikit-learn'], ['Data Science', 'Career Preparation'], 'Completed a fictional demo predictive-maintenance project and mentored a fictional demo study circle.', 'Dev'],
  ['Sana Sheikh', 3, 'CSE', 'offering', 'weekends', ['Java', 'Data Structures', 'C++', 'Problem Solving'], ['Competitive Programming', 'Interview Preparation'], 'Reached a fictional demo contest shortlist and ran a fictional demo data-structures workshop.', 'Sana'],
  ['Neil Fernandes', 3, 'IT', 'offering', 'flexible', ['React', 'Node.js', 'Express', 'MongoDB'], ['Full Stack Development', 'APIs'], 'Released a fictional demo event-booking application and documented a fictional demo REST API.', 'Neil'],
  ['Kavya Bhosale', 3, 'ECE', 'offering', 'weekdays', ['Python', 'Arduino', 'IoT', 'C'], ['Embedded Systems', 'Automation'], 'Built a fictional demo smart-energy monitor and participated in a fictional demo robotics sprint.', 'Kavya'],
  ['Arjun Verma', 3, 'CSE', 'both', 'flexible', ['Python', 'PyTorch', 'NLP', 'Generative AI'], ['AI', 'Natural Language Processing'], 'Created a fictional demo text-classification service and presented a fictional demo AI poster.', 'Arjun'],
  ['Riya Gokhale', 3, 'IT', 'offering', 'weekends', ['SQL', 'PostgreSQL', 'Python', 'ETL'], ['Databases', 'Data Engineering'], 'Designed a fictional demo normalized database and completed a fictional demo ETL pipeline project.', 'Riya'],
  ['Aditya Sethi', 3, 'MECH', 'both', 'flexible', ['Python', 'CAD', 'IoT', 'Data Analysis'], ['Automation', 'Product Management'], 'Prototyped a fictional demo predictive-maintenance workflow and coordinated a fictional demo maker project.', 'Aditya'],
  ['Tanvi Jadhav', 3, 'CSE', 'offering', 'weekdays', ['JavaScript', 'TypeScript', 'React', 'UI/UX Design'], ['Frontend Development', 'Design Systems'], 'Built a fictional demo accessible component library and led a fictional demo frontend review.', 'Tanvi'],
  ['Omkar Desai', 3, 'EXTC', 'seeking', 'weekends', ['C', 'Microcontrollers', 'Python'], ['Embedded Systems', 'Robotics'], 'Completed a fictional demo microcontroller project and attended a fictional demo hardware lab.', 'Omkar'],
  ['Aditi Sinha', 3, 'CIVIL', 'seeking', 'flexible', ['Python', 'Excel', 'Data Visualization'], ['Sustainability', 'Analytics'], 'Created a fictional demo sustainability dashboard and joined a fictional demo data-literacy workshop.', 'Aditi'],
  ['Yash Thakur', 2, 'COMPS', 'both', 'weekends', ['Java', 'C++', 'Data Structures'], ['Algorithms', 'Competitive Programming'], 'Finished a fictional demo algorithms capstone and participated in a fictional demo coding sprint.', 'Yash'],
  ['Mihika Roy', 2, 'CSE', 'seeking', 'flexible', ['Python', 'Pandas', 'HTML', 'CSS'], ['Machine Learning', 'Web Development'], 'Built a fictional demo study planner and completed a fictional demo Python fundamentals course.', 'Mihika'],
  ['Siddhi Kamat', 2, 'IT', 'seeking', 'weekdays', ['JavaScript', 'React', 'SQL'], ['Frontend Development', 'Product Design'], 'Created a fictional demo campus-club page and attended a fictional demo UI workshop.', 'Siddhi'],
  ['Harsh Vora', 2, 'ECE', 'both', 'flexible', ['C', 'Arduino', 'Digital Electronics'], ['IoT', 'Robotics'], 'Assembled a fictional demo sensor kit and took part in a fictional demo electronics challenge.', 'Harsh'],
  ['Zoya Mirza', 2, 'EEE', 'seeking', 'weekends', ['Python', 'SQL', 'Power BI'], ['Data Analytics', 'Energy Systems'], 'Prepared a fictional demo energy-consumption report and completed a fictional demo analytics lab.', 'Zoya'],
  ['Manav Reddy', 2, 'CSE', 'seeking', 'flexible', ['Python', 'Git', 'Linux'], ['Open Source', 'Backend Development'], 'Submitted a fictional demo documentation pull request and built a fictional demo CLI tool.', 'Manav'],
  ['Ira Kapoor', 1, 'COMPS', 'seeking', 'weekends', ['Python', 'HTML', 'CSS'], ['Programming Basics', 'Web Development'], 'Completed a fictional demo introductory programming project and attended a fictional demo web workshop.', 'Ira'],
  ['Kian Fernandes', 1, 'IT', 'seeking', 'flexible', ['Java', 'C', 'Git'], ['Programming', 'App Development'], 'Built a fictional demo console application and joined a fictional demo first-year coding circle.', 'Kian'],
  ['Ayesha Naik', 1, 'ECE', 'seeking', 'weekdays', ['C', 'Arduino', 'Circuit Design'], ['Electronics', 'Embedded Systems'], 'Created a fictional demo LED controller and completed a fictional demo circuits lab.', 'Ayesha'],
  ['Rudra Singh', 1, 'MECH', 'seeking', 'flexible', ['Python', 'CAD', 'Data Analysis'], ['Robotics', 'Automation'], 'Modeled a fictional demo robot component and participated in a fictional demo maker orientation.', 'Rudra'],
];

function userDocument([name, year, department, mentorshipIntent, availability, skills, interests, accomplishment, shortName], index) {
  const [firstName, ...lastParts] = name.split(' ');
  const lastName = lastParts.join(' ');
  return {
    name,
    firstName,
    lastName,
    displayName: name,
    email: `${DEMO_EMAIL_PREFIX}${String(index + 1).padStart(2, '0')}@spit.ac.in`,
    password: DEMO_PASSWORD,
    userType: 'INSTITUTE_MEMBER',
    instituteRole: 'CURRENT_STUDENT',
    year,
    department,
    role: year >= 3 ? 'senior' : 'junior',
    skills,
    interests,
    bio: `Fictional MentorConnect demo profile. ${accomplishment}`,
    mentorshipIntent,
    availability,
    availableForExternalGuidance: false,
    projects: [{
      title: `${shortName}'s demo portfolio project`,
      description: accomplishment,
      technologies: skills.slice(0, 3),
    }],
    profileComplete: true,
    isVerified: true,
    isActive: true,
  };
}

async function seedDemoMentors() {
  await connectDB();
  const emails = DEMO_USERS.map((_, index) => `${DEMO_EMAIL_PREFIX}${String(index + 1).padStart(2, '0')}@spit.ac.in`);
  const existing = await User.find({ email: { $in: emails } }).select('email name').lean();
  const existingEmails = new Set(existing.map((user) => user.email));
  const pending = DEMO_USERS
    .map((data, index) => ({ data, index }))
    .filter(({ index }) => !existingEmails.has(emails[index]));

  console.log(`Demo users planned: ${DEMO_USERS.length}`);
  console.log(`Already present and preserved: ${existing.length}`);
  console.log('Users to create:');
  pending.forEach(({ data, index }) => console.log(`- ${emails[index]} (${data[0]})`));

  const created = [];
  for (const { data, index } of pending) {
    const user = await User.create(userDocument(data, index));
    created.push({ id: String(user._id), name: user.name, email: user.email, year: user.year, department: user.department, mentorshipIntent: user.mentorshipIntent });
  }

  console.log(JSON.stringify({ createdCount: created.length, created }, null, 2));
  await mongoose.disconnect();
}

seedDemoMentors().catch(async (error) => {
  console.error('Demo mentor seeding failed:', error.message);
  await mongoose.disconnect().catch(() => {});
  process.exitCode = 1;
});
