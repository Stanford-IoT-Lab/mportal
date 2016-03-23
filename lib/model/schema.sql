create database if not exists mportal ;
grant all on mportal.* to 'mportal'@'localhost' identified by 'mportal';
use mportal ;

drop view if exists patient_info ;
drop view if exists last_gender_record ;
drop view if exists last_weight_record ;
drop view if exists last_height_record ;

drop table if exists gender_record cascade ;
drop table if exists weight_record cascade ;
drop table if exists height_record cascade ;
drop table if exists medical_record cascade ;
drop table if exists patient_acl cascade ;
drop table if exists doctor cascade ;
drop table if exists user cascade ;
drop table if exists patient cascade ;

create table user (
    id integer auto_increment primary key,
    username varchar(255) unique not null,
    human_name tinytext default null collate utf8_general_ci,
    email varchar(255) not null,
    password char(64) not null,
    salt char(64) not null,
    roles tinyint not null default 0
) collate = utf8_bin ;

create table doctor (
    id integer primary key,
    foreign key (id) references user(id) on update restrict on delete cascade
) collate = utf8_bin ;

create table patient (
    id integer auto_increment primary key,
    omlet_account varchar(255) unique not null,
    full_name varchar(255) not null collate utf8_general_ci,
    nick_name varchar(255) not null collate utf8_general_ci,
    date_of_birth date null
) collate = utf8_bin ;

create table patient_acl (
    doctor_id integer not null,
    patient_id integer not null,
    primary key (doctor_id, patient_id) ,
    foreign key (doctor_id) references doctor(id) on update restrict on delete cascade ,
    foreign key (patient_id) references patient(id) on update restrict on delete cascade
) collate = utf8_bin ;

create table medical_record (
    id integer auto_increment primary key,
    patient_id integer not null,
    capture_time datetime not null,
    collect_time datetime null default null,
    record_type enum('diagnosis', 'xray', 'catscan', 'dnasequence', 'gender', 'weight', 'height', 'other') not null default 'other',
    picture_url varchar(2048) null default null,

    foreign key (patient_id) references patient(id) on update restrict on delete cascade,
    index patient_time (patient_id, capture_time),
    index patient_type_time (patient_id, record_type, capture_time)
) collate utf8_bin ;

create table gender_record (
    id integer primary key,
    gender enum('male', 'female', 'other') not null,
    chromosomes enum('xx', 'xy', 'xxy', 'xyy', 'xxx', 'other') not null,
    other_gender mediumtext null default null,

    foreign key (id) references medical_record(id) on update restrict on delete cascade
) collate utf8_bin ;

create table weight_record (
    id integer primary key,
    weight_kgs double,

    foreign key (id) references medical_record(id) on update restrict on delete cascade
) collate utf8_bin ;

create table height_record (
    id integer primary key,
    height_cms double,

    foreign key (id) references medical_record(id) on update restrict on delete cascade
) collate utf8_bin ;

create view last_gender_record(id, patient_id, collect_time, gender, chromosomes, other_gender)
as select gr.id, mr.patient_id, mr.collect_time, gr.gender, gr.chromosomes, gr.other_gender
from gender_record gr, medical_record mr where gr.id = mr.id and mr.record_type = 'gender' and
mr.capture_time = (select max(mr2.capture_time) from medical_record mr2 where mr2.record_type = 'gender' and mr2.patient_id = mr.patient_id);

create view last_weight_record(id, patient_id, collect_time, weight_kgs)
as select wr.id, mr.patient_id, mr.collect_time, wr.weight_kgs
from weight_record wr, medical_record mr where wr.id = mr.id and mr.record_type = 'weight' and
mr.capture_time = (select max(mr2.capture_time) from medical_record mr2 where mr2.record_type = 'weight' and mr2.patient_id = mr.patient_id);

create view last_height_record(id, patient_id, collect_time, height_cms)
as select hr.id, mr.patient_id, mr.collect_time, hr.height_cms
from height_record hr, medical_record mr where hr.id = mr.id and mr.record_type = 'height' and
mr.capture_time = (select max(mr2.capture_time) from medical_record mr2 where mr2.record_type = 'height' and mr2.patient_id = mr.patient_id);

create view patient_info(id, omlet_account, full_name, nick_name, date_of_birth, gender, weight, height)
as select p.id, p.omlet_account, p.full_name, p.nick_name, p.date_of_birth, gr.gender, wr.weight_kgs, hr.height_cms
from patient p left outer join last_gender_record gr on p.id = gr.patient_id left outer join last_weight_record wr on p.id = wr.patient_id left outer join last_height_record hr on p.id = hr.patient_id ;
