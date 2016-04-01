all:
	npm install
	( cd sempre ; ./pull-dependencies core corenlp ; ant core corenlp )

upload-web:
	rsync -av --delete html/ ~/www/stanford/mportal
	make -C ~/www/stanford sync
