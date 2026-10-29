MentorLink
Major Project - ESE Report
submitted in partial fulfillment of the requirement
for the award of the Degree of
Bachelor of Technology
in
Information Technology
by
Himani Arvind Pilankar
Tithi Kiran Talele
Chetan Vijay Wankhede
under the guidance of
Prof. Soni Bhambar
Co-Guide Name
Department of Information Technology
Bharatiya Vidya Bhavan's
Sardar Patel Institute of Technology
(Autonomous Institute Affiliated to University of Mumbai)
Munshi Nagar, Andheri-West, Mumbai-400058
University of Mumbai

Approval Certificate
This is to certify that the Project entitled “MentorLink” by Himani Pilankar, Tithi Talele and
Chetan Wankhede is approved for the partial fulfillment of Major Project - I for the Final Year Project
towards obtaining the Degree of Bachelor of Technology in Information Technology from University of Mumbai.
Project Guide External Examiner
(signature) (signature)
Name: Prof. Soni Bhambar        Name:
Date:                           Date:
Head of Department Principal
Seal of the Institute

Declaration
I wish to state that the work embodied in this work titled “MentorLink” forms my own contribution
to the work carried out under the guidance of Prof. Soni Bhambar at the Sardar Patel Institute of
Technology. I declare that this written submission represents my ideas in my own words and where
others' ideas or words have been included, I have adequately cited and referenced the original sources.
I also declare that I have adhered to all principles of academic honesty and integrity and have not
misrepresented or fabricated or falsified any idea/data/fact/source in my submission.
Himani Arvind Pilankar    Tithi Kiran Talele    Chetan Vijay Wankhede
2024301021                2024301034            2024301035

Abstract
Peer mentorship plays a significant role in academic and professional development within higher
educational institutions. Senior students frequently guide junior students in areas such as curriculum
planning, internship preparation, project development, and career decision-making. However, in most
institutions, mentorship interactions occur informally through personal networks, messaging platforms,
or classroom discussions. These interactions lack structured documentation, centralized tracking, and
institutional visibility.

An additional limitation of informal mentorship models is restricted accessibility. Students who are
socially hesitant or lack strong peer networks may find it difficult to approach seniors for guidance.
In the absence of a structured mentor discovery mechanism, many students remain underserved,
leading to unequal access to mentorship opportunities.

The absence of a formal mentorship management infrastructure prevents institutions from analyzing
engagement patterns and identifying frequently discussed academic domains.

MentorLink is developed as a centralized, web-based mentorship and academic networking platform
designed to formalize peer mentorship within institutional environments. The platform introduces
verified authentication, structured student profiles, role-based access control, mentorship lifecycle
management, mentor discovery mechanisms, and community-driven academic interaction features.
It also supports structured interaction logging and discussion-based communication to ensure that
mentorship activities are recorded in an organized and analyzable format.

The system has been implemented using the MERN stack architecture, integrating React.js for frontend
development, Node.js and Express.js for backend services, and MongoDB for database management.
Core functionalities including user authentication, profile management, mentorship request workflows,
academic communities, and backend API integration have been successfully implemented. The platform
architecture has also been designed to support future analytics and recommendation-based extensions.

Phase II of the project focuses on implementation, integration, testing, and refinement of the major
system modules. The current implementation establishes a scalable and analytics-ready academic
networking ecosystem capable of supporting future educational data mining, mentor recommendation
enhancement, and engagement analysis techniques.

List of Figures
To be added in the final report.

List of Tables
To be added in the final report.

Contents
1 Introduction
1.1 Problem Statement
1.2 Objectives
1.3 Scope
1.4 Technologies Used
2 Literature Survey
2.1 Literature Survey 1
2.2 Literature Survey 2
3 Analysis
3.1 Analysis diagram 1
3.2 Analysis diagram 2
3.3 Analysis diagram 3
4 Design and Methodology
4.1 Design and Methodology 1
4.2 Design and Methodology 2
4.3 Design and Methodology 3
5 Results and Discussion
5.1 Results and Discussion 1
5.2 Results and Discussion 2
6 Conclusion and Further Work
7 Research Paper
8 Plagiarism Report

1 Introduction
Note: Use subsections and subsubsections wherever required throughout the report.
Introduce your topic here.

1.1 Problem Statement
In most engineering institutes, student mentoring occurs through unstructured channels such as personal
chats, informal conversations, or social messaging platforms. These platforms lack verification,
structure, continuity, and analytical visibility. As a result, mentorship quality varies widely,
interactions are repetitive, and valuable academic insights remain unused.

There is no centralized system that captures mentoring interactions as structured data, nor any
mechanism to analyze these interactions to identify student interests, mentoring patterns, or academic
trends. This leads to inefficient mentorship, lack of accountability, and missed opportunities for
data-driven academic improvement.

1.2 Objectives
To provide a verified, institute-exclusive platform for academic mentoring.
To enable structured interaction between juniors and seniors for guidance and collaboration.
To capture student interactions as structured transactional data.
To apply data mining and analytics techniques to derive academic insights.
To support faculty and administrators with dashboards for data-driven decision-making.

1.3 Scope
The scope of MentorLink includes institute-only mentorship management, role-based user access,
structured profile management, mentorship request handling, academic discussions, and logging of
mentoring interactions for future analytics.

1.3.1 Types of Users
Student (Junior / Senior)
Moderator
Admin / Faculty

1.3.2 Functionalities per Type of User
Student: account management, academic profile, mentorship browsing, requests, discussions, and
communication features.

Admin: user management, community moderation, and system monitoring.

Faculty: analytics dashboard access, academic trend analysis, and academic reporting.

1.3.3 Shared Functionalities
Authentication and authorization
Secure messaging and interaction logging
Search and filter functionality
Notifications for mentoring requests and discussion updates
Institute-only data visibility

1.3.4 Assumptions and Constraints
The platform assumes institute email-based verification for users.
The system is intended for internal academic use only.
Future analytics modules depend on the quality of structured interaction data.

1.4 Technologies Used
Frontend
React.js
Tailwind CSS

Backend
Node.js
Express.js

Database
MongoDB (Operational Database)
PostgreSQL / MySQL (Data Warehouse)

Analytics and AI
Python
Pandas, NumPy
scikit-learn
mlxtend (Apriori Algorithm)

Authentication and Security
JWT
bcrypt
Role-based access control

2 Literature Survey
Note: Use subsections and subsubsections wherever required throughout the report.
Must contain a detailed study of minimum 12 research papers on the project topic and gap finding.

2.1 Literature Survey 1

2.2 Literature Survey 2

3 Analysis
Note: Use subsections and subsubsections wherever required throughout the report.
Use table captions to name tables at the top and use figure titles below figures wherever applicable.
Architecture / DFDs / class diagram / use-case diagram / sequence diagram / flowchart / flow-diagram
(others as suggested by your guide).

3.1 Analysis diagram 1

3.2 Analysis diagram 2

3.3 Analysis diagram 3

4 Design and Methodology
Note: Use subsections and subsubsections wherever required throughout the report.
Proposed System - draw the detailed block diagram to highlight the major modules in your system.
Detail the algorithms/techniques you will be using for implementing each block in your proposed
system. Datasets used. Add any other relevant details.

4.1 Design and Methodology 1

4.2 Design and Methodology 2

4.3 Design and Methodology 3

5 Results and Discussion
Note: Use subsections and subsubsections wherever required throughout the report.
Write the details of implementation/results obtained/relevant screenshots/any relevant discussion and
comparative analysis of methodologies used. Label all tables and figures wherever required.

5.1 Results and Discussion 1

5.2 Results and Discussion 2

6 Conclusion and Further Work
MentorLink is designed as a structured mentoring and academic analytics platform that transforms
informal student interactions into valuable academic intelligence. By combining verified access,
structured mentoring, and data-driven analytics, the system addresses key challenges in student
guidance and institutional decision-making. The project demonstrates a scalable and practical solution
for improving mentoring effectiveness while enabling data-supported academic insights in higher
education institutions.

7 Research Paper

8 Plagiarism Report

References
