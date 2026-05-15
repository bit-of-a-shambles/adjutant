desc "Start both backend and frontend"
task :start do
  puts "Starting Adjutant..."

  # Start Ruby backend
  backend_pid = spawn("mise exec -- ruby backend/bin/adjutant", chdir: __dir__)

  # Give backend a moment to start WebSocket server
  sleep 1

  # Start Electron frontend
  frontend_pid = spawn("mise exec -- npm start", chdir: File.join(__dir__, "frontend"))

  # Handle shutdown
  trap("INT") do
    puts "\nShutting down Adjutant..."
    Process.kill("TERM", frontend_pid) rescue nil
    Process.kill("TERM", backend_pid) rescue nil
    exit
  end

  trap("TERM") do
    Process.kill("TERM", frontend_pid) rescue nil
    Process.kill("TERM", backend_pid) rescue nil
    exit
  end

  # Wait for both processes
  Process.wait(backend_pid) rescue nil
  Process.kill("TERM", frontend_pid) rescue nil
end

desc "Setup project dependencies"
task :setup do
  sh "bash scripts/setup.sh"
end

desc "Start backend only"
task :backend do
  exec "mise exec -- ruby backend/bin/adjutant"
end

desc "Start frontend only"
task :frontend do
  Dir.chdir("frontend") { exec "mise exec -- npm start" }
end

task default: :start
