# Phase 2 Paste-Ready Content from Phase 1

Use the text below directly in the Phase 2 report wherever the corresponding section exists in the template.

## Title Page Text

MentorLink
A Data-Driven Interaction and Academic Analytics Platform

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

Department of Information Technology
Bharatiya Vidya Bhavan’s
Sardar Patel Institute of Technology
(Autonomous Institute Affiliated to University of Mumbai)
Munshi Nagar, Andheri-West, Mumbai-400058
University of Mumbai

## Approval Certificate Text

This is to certify that the Project entitled “MentorLink” by Himani Pilankar, Tithi Talele and Chetan Wankhede is approved for the partial fulfillment of Major Project - I for the Final Year Project towards obtaining the Degree of Bachelor of Technology in Information Technology from University of Mumbai.

Project Guide External Examiner
(signature) (signature)

Name: Prof. Soni Bhambar        Name:
Date:                           Date:

Head of Department             Principal
Seal of the Institute

## Declaration Text

I wish to state that the work embodied in this work titled “MentorLink” forms my own contribution to the work carried out under the guidance of Prof. Soni Bhambar at the Sardar Patel Institute of Technology. I declare that this written submission represents my ideas in my own words and where others' ideas or words have been included, I have adequately cited and referenced the original sources. I also declare that I have adhered to all principles of academic honesty and integrity and have not misrepresented or fabricated or falsified any idea/data/fact/source in my submission.

Himani Arvind Pilankar    Tithi Kiran Talele    Chetan Vijay Wankhede
2024301021                2024301034            2024301035

## Abstract

Peer mentorship plays a significant role in academic and professional development within higher educational institutions. Senior students frequently guide junior students in areas such as curriculum planning, internship preparation, project development, and career decision-making. However, in most institutions, mentorship interactions occur informally through personal networks, messaging platforms, or classroom discussions. These interactions lack structured documentation, centralized tracking, and institutional visibility.

An additional limitation of informal mentorship models is restricted accessibility. Students who are socially hesitant or lack strong peer networks may find it difficult to approach seniors for guidance. In the absence of a structured mentor discovery mechanism, many students remain underserved, leading to unequal access to mentorship opportunities.

The absence of a formal mentorship management infrastructure prevents institutions from analyzing engagement patterns and identifying frequently discussed academic domains.

MentorLink is developed as a centralized, web-based mentorship and academic networking platform designed to formalize peer mentorship within institutional environments. The platform introduces verified authentication, structured student profiles, role-based access control, mentorship lifecycle management, mentor discovery mechanisms, and community-driven academic interaction features. It also supports structured interaction logging and discussion-based communication to ensure that mentorship activities are recorded in an organized and analyzable format.

The system has been implemented using the MERN stack architecture, integrating React.js for frontend development, Node.js and Express.js for backend services, and MongoDB for database management. Core functionalities including user authentication, profile management, mentorship request workflows, academic communities, and backend API integration have been successfully implemented. The platform architecture has also been designed to support future analytics and recommendation-based extensions.

Phase II of the project focuses on implementation, integration, testing, and refinement of the major system modules. The current implementation establishes a scalable and analytics-ready academic networking ecosystem capable of supporting future educational data mining, mentor recommendation enhancement, and engagement analysis techniques.

## Introduction Text

Mentorship plays a significant role in academic growth and professional development within higher educational institutions. Senior students often guide junior students in academic planning, internship preparation, project development, skill enhancement, and career decision-making. Such peer-to-peer mentorship fosters collaborative learning and strengthens academic communities.

However, in most institutions, mentorship interactions occur informally through personal networks, messaging platforms, or casual communication channels. A major limitation of this informal model is accessibility. Students who are introverted, socially hesitant, or lacking strong peer networks often face difficulty in approaching seniors for guidance. In the absence of a structured discovery mechanism and organized communication workflow, many students remain underserved despite having genuine academic needs.

Additionally, informal communication lacks structured documentation. Mentorship discussions are not recorded in an analyzable format, resulting in repetitive queries, fragmented knowledge sharing, and the absence of reusable academic insights.

MentorLink is proposed as a centralized, web-based mentorship and academic networking platform designed to formalize peer mentorship within the institutional ecosystem. The platform introduces a structured digital infrastructure that enables systematic mentor discovery, formal mentorship request workflows, organized interaction logging, and community-based academic discussions.

The system supports multiple user roles including junior students, senior mentors, and administrative moderators. Junior students can explore mentor profiles based on academic attributes, send mentorship requests, participate in structured mentorship conversations, and engage in domain-based communities. Senior students can accept mentorship requests, guide mentees, and actively contribute to academic discussions and community threads.

A key component of the platform is the mentorship lifecycle model, which defines clear states such as request initiation, acceptance, and active mentorship. This structured workflow ensures clarity and accountability in mentorship relationships. The platform also provides one-to-one messaging, group discussions, and public or private academic communities to support collaborative interaction.

Furthermore, the system incorporates a mentor recommendation engine that suggests suitable mentors based on skill similarity, domain interests, and academic compatibility. Interaction logging mechanisms capture structured metadata for mentorship sessions and community participation, preparing the system for future analytical processing.

The primary contributions of MentorLink are as follows:

- Introduction of a structured mentorship lifecycle model.
- Development of a centralized mentor discovery and recommendation mechanism.
- Implementation of Reddit-style academic communities for collaborative discussion.
- Integration of private and group communication features.
- Design of a structured interaction logging system to capture academic metadata.
- Creation of a scalable backend architecture prepared for future data mining integration.

By combining mentorship management, intelligent recommendation, and community-based interaction within a unified platform, MentorLink transforms informal student guidance into an organized and structured academic ecosystem.

## Problem Statement

In most engineering institutes, student mentoring occurs through unstructured channels such as personal chats, informal conversations, or social messaging platforms. These platforms lack verification, structure, continuity, and analytical visibility. As a result, mentorship quality varies widely, interactions are repetitive, and valuable academic insights remain unused.

There is no centralized system that captures mentoring interactions as structured data, nor any mechanism to analyze these interactions to identify student interests, mentoring patterns, or academic trends. This leads to inefficient mentorship, lack of accountability, and missed opportunities for data-driven academic improvement.

## Objectives

To provide a verified, institute-exclusive platform for academic mentoring.

To enable structured interaction between juniors and seniors for guidance and collaboration.

To capture student interactions as structured transactional data.

To apply data mining and analytics techniques to derive academic insights.

To support faculty and administrators with dashboards for data-driven decision-making.

## Scope

The scope of MentorLink is confined to the development of an institute-exclusive web-based mentorship and academic networking platform. The system focuses on formalizing peer mentorship and enabling structured academic collaboration among students.

The project includes secure institute-based user authentication, structured student profile and academic portfolio management, mentor discovery and recommendation mechanisms, mentorship request and lifecycle management, one-to-one messaging and group communication, public and private academic communities, and structured interaction logging for mentorship sessions.

The system is designed with a scalable backend architecture to support future integration of advanced data mining and analytics techniques. However, large-scale predictive analytics and machine learning models will be implemented in subsequent phases of the project.

## Technologies Used

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

## Shared Functionalities Text

Authentication and authorization
Secure messaging and interaction logging
Search and filter functionality
Notifications for mentoring requests and discussion updates
Institute-only data visibility

## User Types Text

Student (Junior / Senior)

Moderator

Admin / Faculty

## Conclusion Text

MentorLink is designed as a structured mentoring and academic analytics platform that transforms informal student interactions into valuable academic intelligence. By combining verified access, structured mentoring, and data-driven analytics, the system addresses key challenges in student guidance and institutional decision-making. The project demonstrates a scalable and practical solution for improving mentoring effectiveness while enabling data-supported academic insights in higher education institutions.
